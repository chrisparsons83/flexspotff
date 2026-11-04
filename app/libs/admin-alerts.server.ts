import { splitDiscordMessage } from './admin-alerts';
import { sendMessageToChannel } from '~/../bot/utils';
import { getSetting } from '~/models/siteSetting.server';

export type AdminAlertResult =
  | { status: 'posted'; messages: number }
  | { status: 'skipped'; reason: string };

/**
 * Posts to the admin alerts channel set on /admin/settings. With no channel set
 * it posts nothing and says so, rather than failing the job that called it.
 * Mentions are switched off: these are notes for admins, not pings.
 *
 * `channelId` overrides the saved setting, for the settings page's test button
 * to check a channel before it is saved.
 */
export async function postAdminAlert(
  content: string,
  channelId?: string,
): Promise<AdminAlertResult> {
  const channel = channelId ?? (await getSetting('adminAlertsChannelId'));
  if (!channel) {
    return { status: 'skipped', reason: 'No admin alerts channel is set' };
  }

  const messages = splitDiscordMessage(content);
  for (const message of messages) {
    await sendMessageToChannel({
      channelId: channel,
      messageData: {
        content: message,
        embeds: [],
        allowed_mentions: { parse: [] },
      },
    });
  }

  return { status: 'posted', messages: messages.length };
}
