import {
  getWaiverReport,
  getWaiverTransactions,
  getWaiverWeeksWithData,
  recordWaiverReport,
  replaceWaiverTransactions,
} from './waiver.server';
import type { WaiverTransactionCreateInput } from './waiver.server';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '~/db.server';
import { truncateDB } from '~/utils/vitest';

const makeLeague = (name: string, year = 2026) =>
  prisma.league.create({
    data: {
      year,
      name,
      sleeperLeagueId: `sleeper-${name}-${year}`,
      sleeperDraftId: `draft-${name}-${year}`,
      tier: 1,
      isActive: true,
    },
  });

const makeUser = (name: string) =>
  prisma.user.create({
    data: {
      discordId: `discord-${name}`,
      discordName: name,
      discordAvatar: '',
    },
  });

const claim = (
  leagueId: string,
  overrides: Partial<WaiverTransactionCreateInput> = {},
): WaiverTransactionCreateInput => ({
  leagueId,
  week: 3,
  sleeperLeg: 2,
  sleeperTransactionId: 'txn-1',
  status: 'complete',
  bid: 10,
  seq: 1,
  notes: null,
  rosterId: 1,
  sleeperOwnerId: 'owner-1',
  userId: null,
  addSleeperId: 'p1',
  addPlayerId: null,
  dropPlayerId: null,
  processedAt: new Date('2026-09-16T07:20:00Z'),
  ...overrides,
});

describe('waiver transactions', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('stores a claim and reads it back', async () => {
    const league = await makeLeague('Champions');
    await replaceWaiverTransactions(league.id, 3, [claim(league.id)]);

    const rows = await getWaiverTransactions(league.id, 3);

    expect(rows).toHaveLength(1);
    expect(rows[0].bid).toBe(10);
    expect(rows[0].sleeperLeg).toBe(2);
  });

  /**
   * The scheduled job makes three passes at the same week and an admin can
   * re-run it at any time, so a second sync must update rather than duplicate.
   */
  it('is idempotent across repeated syncs', async () => {
    const league = await makeLeague('Champions');

    await replaceWaiverTransactions(league.id, 3, [claim(league.id)]);
    await replaceWaiverTransactions(league.id, 3, [
      claim(league.id, { bid: 12 }),
    ]);

    const rows = await getWaiverTransactions(league.id, 3);
    expect(rows).toHaveLength(1);
    expect(rows[0].bid).toBe(12);
  });

  it('keeps the same Sleeper transaction ID separate per league', async () => {
    const champions = await makeLeague('Champions');
    const dragon = await makeLeague('Dragon');

    await replaceWaiverTransactions(champions.id, 3, [claim(champions.id)]);
    await replaceWaiverTransactions(dragon.id, 3, [claim(dragon.id)]);

    expect(await getWaiverTransactions(champions.id, 3)).toHaveLength(1);
    expect(await getWaiverTransactions(dragon.id, 3)).toHaveLength(1);
  });

  it('orders by bid descending, then seq ascending', async () => {
    const league = await makeLeague('Champions');
    await replaceWaiverTransactions(league.id, 3, [
      claim(league.id, { sleeperTransactionId: 'a', bid: 5, seq: 9 }),
      claim(league.id, { sleeperTransactionId: 'b', bid: 9, seq: 3 }),
      claim(league.id, { sleeperTransactionId: 'c', bid: 5, seq: 2 }),
    ]);

    const rows = await getWaiverTransactions(league.id, 3);

    expect(rows.map(row => row.sleeperTransactionId)).toEqual(['b', 'c', 'a']);
  });

  it('joins the linked member through', async () => {
    const league = await makeLeague('Champions');
    const user = await makeUser('alice');

    await replaceWaiverTransactions(league.id, 3, [
      claim(league.id, { userId: user.id }),
    ]);

    const rows = await getWaiverTransactions(league.id, 3);
    expect(rows[0].user?.discordName).toBe('alice');
  });

  /**
   * The reason this is a replace and not a plain upsert. Storing a second,
   * different batch under the same week used to leave both in place, and the
   * report then double-counted in the footer and drew the second winning claim
   * as though that manager had been outbid.
   */
  it('drops claims that are no longer part of the batch', async () => {
    const league = await makeLeague('Champions');

    await replaceWaiverTransactions(league.id, 3, [
      claim(league.id, { sleeperTransactionId: 'old-a' }),
      claim(league.id, { sleeperTransactionId: 'old-b' }),
    ]);
    await replaceWaiverTransactions(league.id, 3, [
      claim(league.id, { sleeperTransactionId: 'new-a' }),
    ]);

    const rows = await getWaiverTransactions(league.id, 3);
    expect(rows.map(row => row.sleeperTransactionId)).toEqual(['new-a']);
  });

  it('leaves other weeks alone when replacing one', async () => {
    const league = await makeLeague('Champions');

    await replaceWaiverTransactions(league.id, 3, [
      claim(league.id, { sleeperTransactionId: 'w3', week: 3 }),
    ]);
    await replaceWaiverTransactions(league.id, 4, [
      claim(league.id, { sleeperTransactionId: 'w4', week: 4 }),
    ]);

    expect(await getWaiverTransactions(league.id, 3)).toHaveLength(1);
    expect(await getWaiverTransactions(league.id, 4)).toHaveLength(1);
  });

  it('lists the weeks that have stored claims', async () => {
    const league = await makeLeague('Champions');
    await replaceWaiverTransactions(league.id, 3, [
      claim(league.id, { sleeperTransactionId: 'a', week: 3 }),
    ]);
    await replaceWaiverTransactions(league.id, 5, [
      claim(league.id, { sleeperTransactionId: 'b', week: 5 }),
      claim(league.id, { sleeperTransactionId: 'c', week: 5 }),
    ]);

    expect(await getWaiverWeeksWithData(2026)).toEqual([5, 3]);
  });
});

describe('waiver reports', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('has no report until one is recorded', async () => {
    const league = await makeLeague('Champions');

    expect(await getWaiverReport(league.id, 3)).toBeNull();

    await recordWaiverReport({ leagueId: league.id, week: 3 });

    expect(await getWaiverReport(league.id, 3)).not.toBeNull();
  });

  /** An admin re-run updates the existing row instead of hitting the unique index. */
  it('updates rather than failing on a re-run', async () => {
    const league = await makeLeague('Champions');

    await recordWaiverReport({ leagueId: league.id, week: 3 });
    const first = await getWaiverReport(league.id, 3);

    await recordWaiverReport({
      leagueId: league.id,
      week: 3,
      discordMessageId: 'msg-2',
    });
    const second = await getWaiverReport(league.id, 3);

    expect(second?.id).toBe(first?.id);
    expect(second?.discordMessageId).toBe('msg-2');
  });

  it('tracks each week separately', async () => {
    const league = await makeLeague('Champions');

    await recordWaiverReport({ leagueId: league.id, week: 3 });

    expect(await getWaiverReport(league.id, 4)).toBeNull();
  });
});
