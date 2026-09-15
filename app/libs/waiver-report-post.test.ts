import * as botUtils from '../../bot/utils';
import * as sleeperApi from './sleeper/api.server';
import * as ownersModule from './sleeper/owners.server';
import { postWaiverReports } from './waiver-report.server';
import * as waiverSync from './waiver-sync.server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as leagueModel from '~/models/league.server';
import * as waiverModel from '~/models/waiver.server';

vi.mock('../../bot/utils');
vi.mock('./waiver-sync.server');
vi.mock('./sleeper/api.server');
vi.mock('./sleeper/owners.server');
vi.mock('~/models/league.server');
vi.mock('~/models/waiver.server');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const CHANNEL = 'channel-1';

const league = (name: string, id = `${name}-id`) =>
  ({
    id,
    name,
    year: 2026,
    sleeperLeagueId: `sleeper-${id}`,
  } as never);

const transaction = () =>
  ({
    id: 'txn-1',
    bid: 5,
    seq: 1,
    status: 'complete',
    notes: null,
    addSleeperId: 'p1',
    sleeperOwnerId: 'owner-1',
    addPlayer: { fullName: 'Jaylen Wright', position: 'RB', nflTeam: 'MIA' },
    dropPlayer: null,
    user: { discordId: '111', discordName: 'alice' },
  } as never);

describe('postWaiverReports', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: the latter leaves an unconsumed
    // `*Once` implementation queued for whichever test runs next.
    vi.resetAllMocks();
    vi.mocked(ownersModule.getOwnerToUserIdMap).mockResolvedValue(new Map());
    vi.mocked(sleeperApi.getLeagueUsers).mockResolvedValue([] as never);
    vi.mocked(waiverSync.syncLeagueWaivers).mockResolvedValue({
      week: 3,
      rows: [],
    } as never);
    vi.mocked(waiverModel.getWaiverReport).mockResolvedValue(null);
    vi.mocked(waiverModel.recordWaiverReport).mockResolvedValue({} as never);
    vi.mocked(waiverModel.getWaiverTransactions).mockResolvedValue([
      transaction(),
    ]);
    vi.mocked(leagueModel.getLeaguesByYear).mockResolvedValue([
      league('Champions'),
    ]);
  });

  /**
   * Mentions in embeds do not notify on their own, but this stops anything in a
   * name from resolving either. It is the guarantee behind "show the tag, don't
   * ping them", so it is asserted directly.
   */
  it('suppresses every mention on the posted message', async () => {
    await postWaiverReports({
      year: 2026,
      week: 3,
      channelId: CHANNEL,
    });

    expect(botUtils.sendMessageToChannel).toHaveBeenCalledTimes(1);
    const call = vi.mocked(botUtils.sendMessageToChannel).mock.calls[0][0];
    expect(call.channelId).toBe(CHANNEL);
    expect(call.messageData.allowed_mentions).toEqual({ parse: [] });
  });

  it('records the league-week once it has posted', async () => {
    await postWaiverReports({ year: 2026, week: 3, channelId: CHANNEL });

    expect(waiverModel.recordWaiverReport).toHaveBeenCalledWith({
      leagueId: 'Champions-id',
      week: 3,
    });
  });

  /** The retry passes at 12:35 and 12:50 must not repost 12:20's work. */
  it('skips a league that has already been reported', async () => {
    vi.mocked(waiverModel.getWaiverReport).mockResolvedValue({
      id: 'report-1',
    } as never);

    const results = await postWaiverReports({
      year: 2026,
      week: 3,
      channelId: CHANNEL,
    });

    expect(results[0].status).toBe('skipped');
    expect(botUtils.sendMessageToChannel).not.toHaveBeenCalled();
  });

  it('reposts an already-reported league when forced', async () => {
    vi.mocked(waiverModel.getWaiverReport).mockResolvedValue({
      id: 'report-1',
    } as never);

    const results = await postWaiverReports({
      year: 2026,
      week: 3,
      force: true,
      channelId: CHANNEL,
    });

    expect(results[0].status).toBe('posted');
    expect(botUtils.sendMessageToChannel).toHaveBeenCalledTimes(1);
  });

  it('posts nothing and records nothing in preview mode', async () => {
    const results = await postWaiverReports({
      year: 2026,
      week: 3,
      preview: true,
      channelId: CHANNEL,
    });

    expect(results[0].status).toBe('preview');
    expect(results[0].embeds?.length).toBeGreaterThan(0);
    expect(botUtils.sendMessageToChannel).not.toHaveBeenCalled();
    expect(waiverModel.recordWaiverReport).not.toHaveBeenCalled();
  });

  it('reports no-data rather than posting an empty embed', async () => {
    vi.mocked(waiverModel.getWaiverTransactions).mockResolvedValue([]);

    const results = await postWaiverReports({
      year: 2026,
      week: 3,
      channelId: CHANNEL,
    });

    expect(results[0].status).toBe('no-data');
    expect(botUtils.sendMessageToChannel).not.toHaveBeenCalled();
    // Left unrecorded on purpose, so a later pass picks the league up.
    expect(waiverModel.recordWaiverReport).not.toHaveBeenCalled();
  });

  it('posts one message per league', async () => {
    vi.mocked(leagueModel.getLeaguesByYear).mockResolvedValue([
      league('Champions'),
      league('Admiral'),
      league('Dragon'),
      league('Galaxy'),
      league('Monarch'),
    ]);

    const results = await postWaiverReports({
      year: 2026,
      week: 3,
      channelId: CHANNEL,
    });

    expect(results).toHaveLength(5);
    expect(botUtils.sendMessageToChannel).toHaveBeenCalledTimes(5);
  });

  it('ignores leagues that are not one of the five', async () => {
    vi.mocked(leagueModel.getLeaguesByYear).mockResolvedValue([
      league('Champions'),
      league('Some Old League'),
    ]);

    const results = await postWaiverReports({
      year: 2026,
      week: 3,
      channelId: CHANNEL,
    });

    expect(results.map(result => result.leagueName)).toEqual(['Champions']);
  });

  it('limits to the requested league', async () => {
    vi.mocked(leagueModel.getLeaguesByYear).mockResolvedValue([
      league('Champions'),
      league('Dragon'),
    ]);

    const results = await postWaiverReports({
      year: 2026,
      week: 3,
      leagueNames: ['dragon'],
      channelId: CHANNEL,
    });

    expect(results.map(result => result.leagueName)).toEqual(['Dragon']);
  });

  /** One league failing should not cost the other four their report. */
  it('keeps going when a single league fails', async () => {
    vi.mocked(leagueModel.getLeaguesByYear).mockResolvedValue([
      league('Champions'),
      league('Dragon'),
    ]);
    vi.mocked(waiverModel.getWaiverTransactions).mockRejectedValueOnce(
      new Error('Sleeper API error 500'),
    );

    const results = await postWaiverReports({
      year: 2026,
      week: 3,
      channelId: CHANNEL,
    });

    expect(results[0].status).toBe('error');
    expect(results[0].message).toContain('500');
    expect(results[1].status).toBe('posted');
  });

  it('errors rather than throwing when no channel is configured', async () => {
    const results = await postWaiverReports({ year: 2026, week: 3 });

    expect(results[0].status).toBe('error');
    expect(results[0].message).toContain('channel');
    expect(botUtils.sendMessageToChannel).not.toHaveBeenCalled();
  });

  /**
   * Reports render from stored claims, never straight from Sleeper. Sleeper drops
   * failed claims from older weeks, so a re-run that re-fetched would show a
   * winner with none of the bids it beat - and with replace semantics it would
   * delete the good rows to do it.
   */
  it('does not re-sync a week that already has stored claims', async () => {
    await postWaiverReports({ year: 2026, week: 3, channelId: CHANNEL });

    expect(waiverSync.syncLeagueWaivers).not.toHaveBeenCalled();
    expect(botUtils.sendMessageToChannel).toHaveBeenCalledTimes(1);
  });

  /** Nothing stored means a sync cannot lose anything, so it is safe to fill in. */
  it('syncs when the week holds nothing yet', async () => {
    vi.mocked(waiverModel.getWaiverTransactions)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([transaction()]);

    const results = await postWaiverReports({
      year: 2026,
      week: 3,
      channelId: CHANNEL,
    });

    expect(waiverSync.syncLeagueWaivers).toHaveBeenCalledWith(
      expect.anything(),
      { week: 3 },
      expect.anything(),
    );
    expect(results[0].status).toBe('posted');
  });

  it('takes the week from the synced batch on the scheduled path', async () => {
    vi.mocked(waiverSync.syncLeagueWaivers).mockResolvedValue({
      week: 9,
      rows: [],
    } as never);

    const results = await postWaiverReports({
      year: 2026,
      batchAfter: new Date('2026-11-04T08:00:00Z'),
      nearWeek: 8,
      channelId: CHANNEL,
    });

    expect(results[0].week).toBe(9);
    expect(waiverModel.getWaiverTransactions).toHaveBeenCalledWith(
      'Champions-id',
      9,
    );
    expect(waiverModel.recordWaiverReport).toHaveBeenCalledWith({
      leagueId: 'Champions-id',
      week: 9,
    });
  });

  /**
   * Discord caps one message at 6000 characters across its embeds and rejects the
   * whole message rather than trimming, so a long week posted as a single message
   * would get no report at all.
   */
  it('posts each embed as its own message', async () => {
    const many = Array.from({ length: 120 }, (_, index) => ({
      ...(transaction() as Record<string, unknown>),
      id: `txn-${index}`,
      addSleeperId: `p${index}`,
      addPlayer: {
        fullName: `A Very Long Player Name Number ${index}`,
        position: 'RB',
        nflTeam: 'MIA',
      },
    }));
    vi.mocked(waiverModel.getWaiverTransactions).mockResolvedValue(
      many as never,
    );

    await postWaiverReports({ year: 2026, week: 3, channelId: CHANNEL });

    const calls = vi.mocked(botUtils.sendMessageToChannel).mock.calls;
    expect(calls.length).toBeGreaterThan(1);
    for (const [call] of calls) {
      expect(call.messageData.embeds).toHaveLength(1);
      expect(call.messageData.allowed_mentions).toEqual({ parse: [] });
    }
  });

  it('reads the member map once for all five leagues', async () => {
    vi.mocked(leagueModel.getLeaguesByYear).mockResolvedValue([
      league('Champions'),
      league('Admiral'),
      league('Dragon'),
      league('Galaxy'),
      league('Monarch'),
    ]);

    await postWaiverReports({ year: 2026, week: 3, channelId: CHANNEL });

    expect(ownersModule.getOwnerToUserIdMap).toHaveBeenCalledTimes(1);
  });
});
