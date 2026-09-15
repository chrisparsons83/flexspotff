import type { League } from '@prisma/client';
import { DateTime } from 'luxon';
import { getLeagueTransactions } from '~/libs/sleeper/api.server';
import { resolveLeagueOwners } from '~/libs/sleeper/owners.server';
import type { SleeperTransaction } from '~/libs/sleeper/schemas';
import { getPlayersBySleepersIds } from '~/models/players.server';
import type { WaiverTransactionCreateInput } from '~/models/waiver.server';
import { replaceWaiverTransactions } from '~/models/waiver.server';

/**
 * Sleeper files a Wednesday waiver batch under the *outgoing* leg: the batch that
 * ran Wed 09-24 00:10, heading into week 4, is stored with `leg: 3`. By Wednesday
 * morning `getNflState().week` has already rolled forward, so querying only that
 * week finds nothing. Fetching this many weeks back covers the boundary without
 * having to reason about the leg numbering at all.
 */
const WEEKS_BACK = 1;

/**
 * Sleeper transactions are milliseconds since the epoch.
 */
const toDate = (epochMs: number) => new Date(epochMs);

/**
 * Every waiver row Sleeper filed under `week` or the weeks just before it,
 * deduped, since the two endpoints overlap at the leg boundary.
 */
async function fetchWaiverTransactions(
  sleeperLeagueId: string,
  week: number,
): Promise<SleeperTransaction[]> {
  const weeks = [];
  for (let offset = 0; offset <= WEEKS_BACK; offset++) {
    const candidate = week - offset;
    if (candidate >= 1) {
      weeks.push(candidate);
    }
  }

  const responses = await Promise.all(
    weeks.map(candidate => getLeagueTransactions(sleeperLeagueId, candidate)),
  );

  const byTransactionId = new Map<string, SleeperTransaction>();
  for (const transaction of responses.flat()) {
    if (transaction.type !== 'waiver') continue;
    byTransactionId.set(transaction.transaction_id, transaction);
  }

  return [...byTransactionId.values()];
}

/**
 * How Sleeper's `leg` relates to the week a batch's claims are for.
 *
 * Sleeper files a Wednesday waiver batch under the *outgoing* leg. The batch that
 * ran Wed 2025-09-24 carries `leg: 3`, but week 3's games were already over - the
 * claims are for week 4. Verified against every Wednesday batch of the 2025
 * season across all five leagues.
 */
export const legToReportWeek = (leg: number) => leg + 1;
export const reportWeekToLeg = (week: number) => week - 1;

export type WaiverBatchSelector = {
  /** Only consider batches at or after this instant. */
  since?: Date;
  /** Only consider batches Sleeper filed under this leg. */
  leg?: number;
};

/**
 * Narrows a set of waiver rows to the single batch we want to report on.
 *
 * Two things have to be excluded, and they need different anchors:
 *
 * - A week's endpoint carries more than the Wednesday run. Champions 2025 week 7
 *   also held rolling clears on Thursday 04:40, Thursday 05:10 and Sunday 11:11.
 *   Every row in one batch shares a `status_updated`, so grouping on it and
 *   taking the latest picks the Wednesday run out of that leg.
 *
 * - Callers pool more than one Sleeper week, so rows from a *different* leg are
 *   in scope too, and those can be newer than the batch being asked for. Taking
 *   the latest batch overall would then quietly return the wrong week's claims,
 *   which is why `leg` exists as an anchor rather than relying on time alone.
 *
 * Getting this wrong does not fail loudly - it posts a plausible report built
 * from the wrong transactions - so it is covered directly by waiver-sync.test.ts.
 */
export function selectWaiverBatch(
  transactions: SleeperTransaction[],
  { since, leg }: WaiverBatchSelector,
): SleeperTransaction[] {
  const cutoff = since?.getTime();

  const eligible = transactions.filter(transaction => {
    if (cutoff !== undefined && transaction.status_updated < cutoff) {
      return false;
    }
    if (leg !== undefined && transaction.leg !== leg) return false;
    return true;
  });
  if (eligible.length === 0) return [];

  const latest = Math.max(
    ...eligible.map(transaction => transaction.status_updated),
  );

  return eligible.filter(transaction => transaction.status_updated === latest);
}

/**
 * The instant the Wednesday batch we care about could have started: midnight
 * Pacific on the Wednesday of `reference`'s week.
 *
 * Pacific rather than UTC because that is when Sleeper clears these leagues, and
 * the offset moves when DST ends mid-season. Luxon's `weekday` is 1-7 from
 * Monday, so Wednesday is 3 - the same arithmetic syncs.server.ts uses to snap
 * season weeks to a Wednesday start.
 */
export function wednesdayMidnightPacific(reference: Date): Date {
  const pacific = DateTime.fromJSDate(reference).setZone('America/Los_Angeles');

  return pacific
    .minus({ days: (pacific.weekday - 3 + 7) % 7 })
    .startOf('day')
    .toJSDate();
}

/**
 * Which batch to sync.
 *
 * `since` is the scheduled job: whatever ran this morning, whose week is then
 * read off the batch itself. `week` is a re-run: the batch belonging to a report
 * week the caller already knows.
 */
export type WaiverSyncTarget =
  | {
      /** The batch that ran at or after this instant. */
      since: Date;
      /** Roughly which Sleeper week to look in; both it and the one before are fetched. */
      nearWeek: number;
    }
  | {
      /** The report week to fetch the batch for. */
      week: number;
    };

export type SyncLeagueWaiversOptions = {
  /**
   * A map from getOwnerToUserIdMap(). Callers syncing more than one league should
   * build it once and pass it in - it reads every member row, and leaving it to
   * each league means that whole query runs once per league, concurrently.
   */
  ownerToUserId?: Map<string, string>;
};

export type SyncLeagueWaiversResult = {
  /** The report week the batch was stored under, derived from its leg. */
  week: number;
  rows: WaiverTransactionCreateInput[];
};

/**
 * Pulls one league's Wednesday waiver batch from Sleeper and stores it.
 *
 * The week rows are stored under is always derived from the batch's own `leg`,
 * never from the caller's guess, so a caller working from an NFL state that has
 * not rolled over yet cannot misfile a batch.
 */
export async function syncLeagueWaivers(
  league: Pick<League, 'id' | 'sleeperLeagueId'>,
  target: WaiverSyncTarget,
  { ownerToUserId }: SyncLeagueWaiversOptions = {},
): Promise<SyncLeagueWaiversResult | null> {
  const searchWeek =
    'week' in target ? reportWeekToLeg(target.week) + 1 : target.nearWeek;

  const allWaivers = await fetchWaiverTransactions(
    league.sleeperLeagueId,
    searchWeek,
  );

  const batch = selectWaiverBatch(
    allWaivers,
    'week' in target
      ? { leg: reportWeekToLeg(target.week) }
      : { since: target.since },
  );
  if (batch.length === 0) return null;

  const week = legToReportWeek(batch[0].leg);

  const { rosterToOwner, ownerToUserId: resolvedOwnerToUserId } =
    await resolveLeagueOwners(league.sleeperLeagueId, ownerToUserId);

  const playerSleeperIds = new Set<string>();
  for (const transaction of batch) {
    for (const key of Object.keys(transaction.adds ?? {})) {
      playerSleeperIds.add(key);
    }
    for (const key of Object.keys(transaction.drops ?? {})) {
      playerSleeperIds.add(key);
    }
  }
  const players = await getPlayersBySleepersIds([...playerSleeperIds]);
  const playerIdBySleeperId = new Map(
    players.map(player => [player.sleeperId, player.id]),
  );

  const rows: WaiverTransactionCreateInput[] = [];
  for (const transaction of batch) {
    // A waiver claim always adds exactly one player; without an add there is
    // nothing to report on.
    const addSleeperId = Object.keys(transaction.adds ?? {})[0];
    if (!addSleeperId) continue;

    const rosterId = transaction.roster_ids[0];
    const sleeperOwnerId =
      transaction.creator || rosterToOwner.get(rosterId) || '';
    const dropSleeperId = Object.keys(transaction.drops ?? {})[0];

    rows.push({
      leagueId: league.id,
      week,
      sleeperLeg: transaction.leg,
      sleeperTransactionId: transaction.transaction_id,
      status: transaction.status,
      bid: transaction.settings?.waiver_bid ?? 0,
      seq: transaction.settings?.seq ?? 0,
      notes: transaction.metadata?.notes ?? null,
      rosterId,
      sleeperOwnerId,
      userId: resolvedOwnerToUserId.get(sleeperOwnerId) ?? null,
      addSleeperId,
      addPlayerId: playerIdBySleeperId.get(addSleeperId) ?? null,
      dropPlayerId: dropSleeperId
        ? playerIdBySleeperId.get(dropSleeperId) ?? null
        : null,
      processedAt: toDate(transaction.status_updated),
    });
  }

  await replaceWaiverTransactions(league.id, week, rows);

  return { week, rows };
}
