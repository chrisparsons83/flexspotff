import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useNavigation } from '@remix-run/react';
import {
  typedjson,
  useTypedActionData,
  useTypedLoaderData,
} from 'remix-typedjson';
import Alert from '~/components/ui/Alert';
import { Button } from '~/components/ui/button';
import { Field } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Section } from '~/components/ui/section';
import { postAdminAlert } from '~/libs/admin-alerts.server';
import {
  getSettings,
  isDiscordId,
  isSiteSettingKey,
  setSetting,
  SITE_SETTING_KEYS,
  SITE_SETTINGS,
} from '~/models/siteSetting.server';
import { authenticator, requireAdmin } from '~/services/auth.server';
import type { RouteHandle } from '~/utils/route-handle';
import { timeAgo } from '~/utils/scheduler-health';

export const handle: RouteHandle = { title: 'Settings' };

type ActionData = {
  key: string;
  message: string;
  status: 'success' | 'error';
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // The admin layout only requires an editor, and layout loaders do not guard
  // child actions, so this has to check for admin itself.
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const key = formData.get('key');
  const value = formData.get('value');
  if (!isSiteSettingKey(key) || typeof value !== 'string') {
    throw new Response('Unknown setting', { status: 400 });
  }

  const setting = SITE_SETTINGS[key];
  const trimmed = value.trim();
  if (trimmed && setting.kind === 'discordId' && !isDiscordId(trimmed)) {
    return typedjson<ActionData>({
      key,
      message: `${setting.label} must be a Discord ID: 17 to 20 digits.`,
      status: 'error',
    });
  }

  switch (formData.get('_action')) {
    case 'save': {
      await setSetting(key, trimmed, user.id);
      return typedjson<ActionData>({
        key,
        message: trimmed
          ? `${setting.label} saved.`
          : `${setting.label} cleared.`,
        status: 'success',
      });
    }
    case 'test': {
      if (!trimmed) {
        return typedjson<ActionData>({
          key,
          message: 'Enter a channel ID to send a test message to.',
          status: 'error',
        });
      }
      // Tests what is in the box, saved or not, so a channel can be checked
      // before anything starts posting to it.
      try {
        await postAdminAlert(
          `Test message from the FlexSpot FF admin settings page, sent by ${user.discordName}.`,
          trimmed,
        );
      } catch (error) {
        console.error('Admin alert test failed:', error);
        return typedjson<ActionData>({
          key,
          message:
            'Discord did not accept the message. Check the channel ID and that the bot can post there.',
          status: 'error',
        });
      }
      return typedjson<ActionData>({
        key,
        message: 'Test message sent.',
        status: 'success',
      });
    }
  }

  throw new Response('Unknown action', { status: 400 });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const saved = await getSettings();
  const now = new Date();

  return typedjson({
    settings: SITE_SETTING_KEYS.map(key => {
      const row = saved.find(setting => setting.key === key);
      return {
        key,
        label: SITE_SETTINGS[key].label,
        description: SITE_SETTINGS[key].description,
        kind: SITE_SETTINGS[key].kind,
        value: row?.value ?? '',
        updated: row
          ? `Last changed ${timeAgo(row.updatedAt, now)}${
              row.updatedBy ? ` by ${row.updatedBy.discordName}` : ''
            }.`
          : null,
      };
    }),
  });
};

export default function AdminSettingsPage() {
  const { settings } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <Section title='Settings'>
      {settings.map(setting => (
        <Form
          key={setting.key}
          method='POST'
          className='grid max-w-md gap-6'
          aria-label={setting.label}
        >
          {actionData?.key === setting.key && (
            <Alert message={actionData.message} status={actionData.status} />
          )}
          <input type='hidden' name='key' value={setting.key} />
          <Field
            label={setting.label}
            description={
              setting.updated
                ? `${setting.description} ${setting.updated}`
                : setting.description
            }
          >
            <Input
              name='value'
              defaultValue={setting.value}
              inputMode={setting.kind === 'discordId' ? 'numeric' : undefined}
              autoComplete='off'
            />
          </Field>
          <div className='flex flex-wrap gap-3'>
            <Button
              type='submit'
              name='_action'
              value='save'
              disabled={navigation.state !== 'idle'}
            >
              Save
            </Button>
            {setting.kind === 'discordId' && (
              <Button
                type='submit'
                variant='secondary'
                name='_action'
                value='test'
                disabled={navigation.state !== 'idle'}
              >
                Send Test Message
              </Button>
            )}
          </div>
        </Form>
      ))}
    </Section>
  );
}
