import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { z } from 'zod';
import type { DeleteCommandsProps } from '~/../bot/utils';
import { deleteCommand, deployCommands, getCommands } from '~/../bot/utils';
import { Button } from '~/components/ui/button';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { envSchema } from '~/utils/helpers';

export const action = async ({ request }: ActionFunctionArgs) => {
  // The admin layout only requires an editor, and layout loaders do not guard
  // child actions, so this has to check for admin itself. Without it these
  // buttons deploy and delete live Discord commands for anyone who finds them.
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const env = envSchema.parse(process.env);

  const formData = await request.formData();
  const action = formData.get('_action');

  switch (action) {
    case 'registerGuildCommands': {
      await deployCommands({ guildId: env.DEV_GUILD_ID });
      break;
    }
    case 'registerGlobalCommands': {
      await deployCommands(null);
      break;
    }
    case 'deleteCommand': {
      const commandId = z.string().parse(formData.get('commandId'));
      const guildId = z.nullable(z.string()).parse(formData.get('guildId'));
      const params: DeleteCommandsProps = { commandId };

      // We do this for safety, since we're certain this dev guild ID is good.
      if (guildId) params.guildId = env.DEV_GUILD_ID;

      await deleteCommand(params);
      break;
    }
  }

  return typedjson({ message: 'Commands loaded.' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const env = envSchema.parse(process.env);

  const guildCommands = await getCommands({ guildId: env.DEV_GUILD_ID });
  const globalCommands = await getCommands(null);

  return typedjson({
    devGuildId: env.DEV_GUILD_ID,
    guildCommands,
    globalCommands,
  });
};

export default function AdminBotPage() {
  const { devGuildId, guildCommands, globalCommands } =
    useTypedLoaderData<typeof loader>();

  const commandList = (commands: typeof globalCommands, guildId?: string) =>
    commands && commands.length > 0 ? (
      <Table headers={['Command', '']}>
        {commands.map(command => (
          <tr key={command.id}>
            <td className='font-mono'>{command.name}</td>
            <td className='text-right'>
              <Form method='post'>
                <input type='hidden' name='commandId' value={command.id} />
                {guildId && (
                  <input type='hidden' name='guildId' value={guildId} />
                )}
                <Button
                  type='submit'
                  variant='secondary'
                  size='sm'
                  name='_action'
                  value='deleteCommand'
                >
                  Delete
                </Button>
              </Form>
            </td>
          </tr>
        ))}
      </Table>
    ) : (
      <p className='text-muted-foreground'>No commands registered.</p>
    );

  return (
    <Section title='Bot Commands'>
      <Form method='post' className='flex flex-wrap gap-3'>
        <Button type='submit' name='_action' value='registerGuildCommands'>
          Register Dev Guild Commands
        </Button>
        <Button type='submit' name='_action' value='registerGlobalCommands'>
          Register Global Commands
        </Button>
      </Form>
      <Section as='h3' title='Global Commands'>
        {commandList(globalCommands)}
      </Section>
      <Section as='h3' title='Dev Guild Commands'>
        {commandList(guildCommands, devGuildId)}
      </Section>
    </Section>
  );
}
