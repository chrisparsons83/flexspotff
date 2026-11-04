import { action } from './admin.settings';
import type { ActionFunctionArgs } from '@remix-run/node';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as adminAlerts from '~/libs/admin-alerts.server';
import * as settingModel from '~/models/siteSetting.server';
import * as auth from '~/services/auth.server';

vi.mock('~/services/auth.server', () => ({
  authenticator: { isAuthenticated: vi.fn() },
  requireAdmin: vi.fn(),
}));
vi.mock('~/libs/admin-alerts.server');
vi.mock('~/models/siteSetting.server', async () => ({
  ...(await vi.importActual<typeof settingModel>(
    '~/models/siteSetting.server',
  )),
  setSetting: vi.fn(),
  getSettings: vi.fn(),
}));
vi.mock('~/db.server', () => ({ prisma: {} }));

const admin = { id: 'user-admin', discordName: 'Admin' };

const post = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return {
    request: new Request('http://localhost/admin/settings', {
      method: 'POST',
      body,
    }),
    params: {},
    context: {},
  } as ActionFunctionArgs;
};

describe('admin settings action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(
      admin as never,
    );
  });

  it('checks for an admin before doing anything', async () => {
    vi.mocked(auth.requireAdmin).mockImplementationOnce(() => {
      throw new Response('Forbidden', { status: 403 });
    });

    await expect(
      action(
        post({ key: 'adminAlertsChannelId', value: '1', _action: 'save' }),
      ),
    ).rejects.toBeInstanceOf(Response);
    expect(settingModel.setSetting).not.toHaveBeenCalled();
  });

  it('saves a valid channel ID against the admin who set it', async () => {
    await action(
      post({
        key: 'adminAlertsChannelId',
        value: ' 123456789012345678 ',
        _action: 'save',
      }),
    );

    expect(settingModel.setSetting).toHaveBeenCalledWith(
      'adminAlertsChannelId',
      '123456789012345678',
      'user-admin',
    );
  });

  it('rejects something that is not a Discord ID', async () => {
    const response = await action(
      post({ key: 'adminAlertsChannelId', value: '#admin', _action: 'save' }),
    );

    expect(settingModel.setSetting).not.toHaveBeenCalled();
    expect(JSON.stringify(await response.json())).toContain('17 to 20 digits');
  });

  it('clears the setting when the box is emptied', async () => {
    await action(
      post({ key: 'adminAlertsChannelId', value: '', _action: 'save' }),
    );

    expect(settingModel.setSetting).toHaveBeenCalledWith(
      'adminAlertsChannelId',
      '',
      'user-admin',
    );
  });

  it('refuses a key that is not a known setting', async () => {
    await expect(
      action(post({ key: 'DATABASE_URL', value: 'x', _action: 'save' })),
    ).rejects.toBeInstanceOf(Response);
  });

  it('sends a test message to the channel in the box without saving it', async () => {
    vi.mocked(adminAlerts.postAdminAlert).mockResolvedValue({
      status: 'posted',
      messages: 1,
    });

    await action(
      post({
        key: 'adminAlertsChannelId',
        value: '123456789012345678',
        _action: 'test',
      }),
    );

    expect(adminAlerts.postAdminAlert).toHaveBeenCalledWith(
      expect.stringContaining('Test message'),
      '123456789012345678',
    );
    expect(settingModel.setSetting).not.toHaveBeenCalled();
  });
});
