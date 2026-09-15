import week3Fixture from './__fixtures__/sleeper-transactions-champions-2025-week3.json';
import week7Fixture from './__fixtures__/sleeper-transactions-champions-2025-week7.json';
import dragonWeek2Fixture from './__fixtures__/sleeper-transactions-dragon-2025-week2.json';
import * as ownersModule from './sleeper/owners.server';
import type { SleeperTransaction } from './sleeper/schemas';
import {
  legToReportWeek,
  reportWeekToLeg,
  selectWaiverBatch,
  syncLeagueWaivers,
  wednesdayMidnightPacific,
} from './waiver-sync.server';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as playerModel from '~/models/players.server';
import * as waiverModel from '~/models/waiver.server';

vi.mock('./sleeper/owners.server');
vi.mock('~/models/players.server');
vi.mock('~/models/waiver.server');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const week3 = week3Fixture as unknown as SleeperTransaction[];
const week7 = week7Fixture as unknown as SleeperTransaction[];
/** Leg 2: a 26-claim run at 00:13 PT and one stray clear at 19:23 the same day. */
const dragonWeek2 = dragonWeek2Fixture as unknown as SleeperTransaction[];

/** Midnight Pacific on the Wednesday the week 3 batch ran (2025-09-24). */
const WEEK3_WEDNESDAY = DateTime.fromISO('2025-09-24T00:00:00', {
  zone: 'America/Los_Angeles',
}).toJSDate();

/** Midnight Pacific on the Wednesday the week 7 batch ran (2025-10-22). */
const WEEK7_WEDNESDAY = DateTime.fromISO('2025-10-22T00:00:00', {
  zone: 'America/Los_Angeles',
}).toJSDate();

describe('selectWaiverBatch', () => {
  it('returns the whole Wednesday batch', () => {
    const waivers = week3.filter(transaction => transaction.type === 'waiver');
    const batch = selectWaiverBatch(waivers, { since: WEEK3_WEDNESDAY });

    expect(batch).toHaveLength(24);
    expect(batch.filter(t => t.status === 'complete')).toHaveLength(10);
    expect(batch.filter(t => t.status === 'failed')).toHaveLength(14);
  });

  it('shares a single status_updated across the batch', () => {
    const waivers = week3.filter(t => t.type === 'waiver');
    const batch = selectWaiverBatch(waivers, { since: WEEK3_WEDNESDAY });

    expect(new Set(batch.map(t => t.status_updated)).size).toBe(1);
  });

  /**
   * The case this whole function exists for. Week 7's endpoint also carries
   * rolling waiver clears on Thursday and Sunday; including them would post a
   * plausible-looking report built from the wrong transactions.
   */
  it('excludes mid-week rolling waiver clears', () => {
    const waivers = week7.filter(t => t.type === 'waiver');
    expect(waivers.length).toBeGreaterThan(22);

    const batch = selectWaiverBatch(waivers, { since: WEEK7_WEDNESDAY });

    expect(batch).toHaveLength(22);
    for (const transaction of batch) {
      const pacific = DateTime.fromMillis(transaction.status_updated).setZone(
        'America/Los_Angeles',
      );
      expect(pacific.weekday).toBe(3);
      expect(pacific.hour).toBe(0);
    }
  });

  it('returns nothing when no batch has run since the cutoff', () => {
    const waivers = week3.filter(t => t.type === 'waiver');
    const nextWeek = DateTime.fromJSDate(WEEK3_WEDNESDAY)
      .plus({ days: 7 })
      .toJSDate();

    expect(selectWaiverBatch(waivers, { since: nextWeek })).toEqual([]);
  });

  it('takes the most recent batch when several are eligible', () => {
    const waivers = week7.filter(t => t.type === 'waiver');
    // From the epoch, the Thursday and Sunday clears are eligible too.
    const batch = selectWaiverBatch(waivers, { since: new Date(0) });

    expect(batch).toHaveLength(22);
  });
});

describe('selectWaiverBatch anchored by leg', () => {
  /**
   * The bug this guards. A re-run pools more than one Sleeper week, and the
   * *next* week's batch is strictly newer than the one being asked for, so
   * "latest batch overall" silently returned claims one week off - and stored
   * them under the requested week, titled with the requested week.
   */
  it('ignores a newer batch from a different leg', () => {
    const pooled = [...week3, ...week7].filter(t => t.type === 'waiver');

    const batch = selectWaiverBatch(pooled, { leg: 3 });

    expect(batch).toHaveLength(24);
    expect(batch.every(transaction => transaction.leg === 3)).toBe(true);
  });

  it('still picks the Wednesday run out of its own leg', () => {
    const pooled = [...week3, ...week7].filter(t => t.type === 'waiver');

    // Leg 7 holds rolling clears on Thursday and Sunday as well.
    const batch = selectWaiverBatch(pooled, { leg: 7 });

    expect(batch).toHaveLength(22);
  });

  /**
   * The real run is not always the last batch in its leg. Dragon cleared one more
   * claim at 19:23 the same Wednesday, and taking the latest returned that single
   * claim as the whole week's report.
   */
  it('prefers the midnight run over a later clear the same Wednesday', () => {
    const waivers = dragonWeek2.filter(t => t.type === 'waiver');

    const batch = selectWaiverBatch(waivers, { leg: 2 });

    expect(batch).toHaveLength(26);
    expect(legToReportWeek(batch[0].leg)).toBe(3);
  });

  it('applies the same preference on the scheduled path', () => {
    const waivers = dragonWeek2.filter(t => t.type === 'waiver');
    const wednesday = DateTime.fromISO('2025-09-17T00:00:00', {
      zone: 'America/Los_Angeles',
    }).toJSDate();

    expect(selectWaiverBatch(waivers, { since: wednesday })).toHaveLength(26);
  });

  it('still returns an unusual run when nothing is in the window', () => {
    const waivers = dragonWeek2
      .filter(t => t.type === 'waiver')
      // Drop the midnight run, leaving only the 19:23 clear.
      .filter(t => t.status_updated !== 1758093206726);

    expect(selectWaiverBatch(waivers, { leg: 2 })).toHaveLength(1);
  });

  it('returns nothing for a leg with no waiver batch', () => {
    const waivers = week3.filter(t => t.type === 'waiver');

    expect(selectWaiverBatch(waivers, { leg: 99 })).toEqual([]);
  });
});

describe('legToReportWeek', () => {
  /**
   * Sleeper files the Wednesday batch under the outgoing leg, so the claims in
   * leg 3 are for week 4's games. Verified against every 2025 Wednesday batch.
   */
  it('maps a leg to the week its claims are for', () => {
    expect(legToReportWeek(3)).toBe(4);
    expect(reportWeekToLeg(4)).toBe(3);
  });
});

describe('wednesdayMidnightPacific', () => {
  it('snaps back to the Wednesday that started the week', () => {
    // Friday
    const friday = DateTime.fromISO('2025-09-26T09:30:00', {
      zone: 'America/Los_Angeles',
    }).toJSDate();

    expect(wednesdayMidnightPacific(friday).toISOString()).toBe(
      WEEK3_WEDNESDAY.toISOString(),
    );
  });

  it('treats Wednesday morning as its own Wednesday', () => {
    const wednesday = DateTime.fromISO('2025-09-24T00:20:00', {
      zone: 'America/Los_Angeles',
    }).toJSDate();

    expect(wednesdayMidnightPacific(wednesday).toISOString()).toBe(
      WEEK3_WEDNESDAY.toISOString(),
    );
  });

  /**
   * DST ends mid-season, so the same wall-clock midnight is a different UTC
   * instant in November than in September. A fixed UTC offset would drift.
   */
  it('holds midnight Pacific across the DST boundary', () => {
    const beforeDst = wednesdayMidnightPacific(
      DateTime.fromISO('2026-10-21T00:20:00', {
        zone: 'America/Los_Angeles',
      }).toJSDate(),
    );
    const afterDst = wednesdayMidnightPacific(
      DateTime.fromISO('2026-11-04T00:20:00', {
        zone: 'America/Los_Angeles',
      }).toJSDate(),
    );

    expect(beforeDst.toISOString()).toBe('2026-10-21T07:00:00.000Z');
    expect(afterDst.toISOString()).toBe('2026-11-04T08:00:00.000Z');
  });
});

describe('syncLeagueWaivers', () => {
  const realFetch = globalThis.fetch;
  const mockFetch = vi.fn();
  const league = { id: 'league-1', sleeperLeagueId: 'sleeper-1' };

  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch;

    vi.mocked(ownersModule.resolveLeagueOwners).mockResolvedValue({
      rosterToOwner: new Map([[8, 'owner-8']]),
      ownerToUserId: new Map([['332687713452965888', 'user-a']]),
    });
    vi.mocked(playerModel.getPlayersBySleepersIds).mockResolvedValue([]);
    vi.mocked(waiverModel.replaceWaiverTransactions).mockResolvedValue(
      [] as never,
    );
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    vi.clearAllMocks();
  });

  /** Serves week N from the fixture and an empty list for N-1. */
  const serveWeek = (week: number, body: unknown) => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const href = input.toString();
      return {
        ok: true,
        status: 200,
        json: async () => (href.endsWith(`/transactions/${week}`) ? body : []),
      } as Response;
    });
  };

  it('stores only the Wednesday batch, not free agent adds', async () => {
    serveWeek(3, week3);

    const synced = await syncLeagueWaivers(league, {
      since: WEEK3_WEDNESDAY,
      nearWeek: 4,
    });
    const rows = synced?.rows ?? [];

    expect(rows).toHaveLength(24);
    expect(rows.every(row => row.week === 4)).toBe(true);
    // Sleeper filed the batch under the outgoing leg.
    expect(rows.every(row => row.sleeperLeg === 3)).toBe(true);
  });

  it('queries the requested week and the one before it', async () => {
    serveWeek(3, week3);

    await syncLeagueWaivers(league, { since: WEEK3_WEDNESDAY, nearWeek: 4 });

    const urls = mockFetch.mock.calls.map(call => call[0].toString());
    expect(urls.some(url => url.endsWith('/transactions/4'))).toBe(true);
    expect(urls.some(url => url.endsWith('/transactions/3'))).toBe(true);
  });

  it('resolves defense abbreviations as well as numeric player IDs', async () => {
    serveWeek(3, week3);
    vi.mocked(playerModel.getPlayersBySleepersIds).mockResolvedValue([
      { id: 'player-det', sleeperId: 'DET' },
      { id: 'player-3214', sleeperId: '3214' },
    ] as never);

    const synced = await syncLeagueWaivers(league, {
      since: WEEK3_WEDNESDAY,
      nearWeek: 4,
    });
    const rows = synced?.rows ?? [];

    const requested = vi.mocked(playerModel.getPlayersBySleepersIds).mock
      .calls[0][0];
    expect(requested).toContain('DET');
    expect(requested).toContain('3214');

    expect(rows.find(row => row.addSleeperId === 'DET')?.addPlayerId).toBe(
      'player-det',
    );
    expect(rows.find(row => row.addSleeperId === '3214')?.addPlayerId).toBe(
      'player-3214',
    );
  });

  it('leaves addPlayerId null for a player we have never synced', async () => {
    serveWeek(3, week3);

    const synced = await syncLeagueWaivers(league, {
      since: WEEK3_WEDNESDAY,
      nearWeek: 4,
    });
    const rows = synced?.rows ?? [];

    // No players were returned, so every add stays unresolved but is still
    // stored under its raw Sleeper key.
    expect(rows.every(row => row.addPlayerId === null)).toBe(true);
    expect(rows.every(row => row.addSleeperId.length > 0)).toBe(true);
  });

  it('stores the Sleeper owner for a manager with no linked member', async () => {
    serveWeek(3, week3);

    const synced = await syncLeagueWaivers(league, {
      since: WEEK3_WEDNESDAY,
      nearWeek: 4,
    });
    const rows = synced?.rows ?? [];

    const linked = rows.filter(row => row.userId !== null);
    const unlinked = rows.filter(row => row.userId === null);

    expect(linked.length).toBeGreaterThan(0);
    expect(unlinked.length).toBeGreaterThan(0);
    expect(unlinked.every(row => row.sleeperOwnerId.length > 0)).toBe(true);
  });

  it('carries the failure reason through', async () => {
    serveWeek(3, week3);

    const synced = await syncLeagueWaivers(league, {
      since: WEEK3_WEDNESDAY,
      nearWeek: 4,
    });
    const rows = synced?.rows ?? [];

    const failed = rows.filter(row => row.status === 'failed');
    expect(
      failed.some(
        row => row.notes === 'This player was claimed by another owner.',
      ),
    ).toBe(true);
    expect(failed.some(row => row.notes?.includes('too many players'))).toBe(
      true,
    );
  });

  /**
   * The end-to-end shape of the week-selection bug: asking for a week must not
   * return the next week's batch just because it is newer.
   */
  it('stores the batch for the week asked for, not the newest one', async () => {
    mockFetch.mockImplementation(async (input: RequestInfo | URL) => {
      const href = input.toString();
      const body = href.endsWith('/transactions/3')
        ? week3
        : href.endsWith('/transactions/4')
        ? week7
        : [];
      return { ok: true, status: 200, json: async () => body } as Response;
    });

    const synced = await syncLeagueWaivers(league, { week: 4 });

    expect(synced?.week).toBe(4);
    expect(synced?.rows).toHaveLength(24);
    expect(synced?.rows.every(row => row.sleeperLeg === 3)).toBe(true);
  });

  it('derives the week from the batch rather than the caller', async () => {
    serveWeek(3, week3);

    // nearWeek is deliberately wrong; the leg still decides.
    const synced = await syncLeagueWaivers(league, {
      since: WEEK3_WEDNESDAY,
      nearWeek: 3,
    });

    expect(synced?.week).toBe(4);
  });

  it('replaces what was stored rather than piling batches up', async () => {
    serveWeek(3, week3);

    await syncLeagueWaivers(league, { since: WEEK3_WEDNESDAY, nearWeek: 4 });

    const [leagueId, week, rows] = vi.mocked(
      waiverModel.replaceWaiverTransactions,
    ).mock.calls[0];
    expect(leagueId).toBe('league-1');
    expect(week).toBe(4);
    expect(rows).toHaveLength(24);
  });

  it('writes nothing when no batch has run since the cutoff', async () => {
    serveWeek(3, week3);

    const synced = await syncLeagueWaivers(league, {
      since: new Date('2030-01-01T00:00:00Z'),
      nearWeek: 4,
    });

    expect(synced).toBeNull();
    expect(waiverModel.replaceWaiverTransactions).not.toHaveBeenCalled();
  });
});
