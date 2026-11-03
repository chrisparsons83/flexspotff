import {
  GUILLOTINE_FINAL_WEEK,
  resolveChops,
  resolveRosterOwners,
  weekStarters,
  weeksToSync,
} from './chops';
import type { ChopWeekRow } from './chops';
import { scoreProjection } from './projection';
import type { GuillotineFormat } from '@prisma/client';
import type {
  SleeperAdpJson,
  SleeperDraftListJson,
  SleeperGuillotineRostersJson,
  SleeperLeagueInfoJson,
  SleeperMatchupJson,
  SleeperProjectionsJson,
  SleeperTransaction,
} from '~/libs/sleeper/schemas';

type SleeperAccount = {
  user_id: string;
  username?: string | null;
  display_name?: string | null;
};

/** What a sync fetched from Sleeper for one league. */
export type GuillotineSleeperData = {
  info: SleeperLeagueInfoJson;
  rosters: SleeperGuillotineRostersJson;
  users: SleeperAccount[];
  /** Owners missing from the users list, looked up one by one. */
  departedUsers: SleeperAccount[];
  draft: SleeperDraftListJson[number] | undefined;
  /** Every week in syncWeeks, by week. */
  matchups: Map<number, SleeperMatchupJson>;
  /** Every leg's transactions, in leg order. */
  transactions: SleeperTransaction[];
  picks: SleeperAdpJson;
  /** Null when there is no live week or the fetch failed. */
  projections: SleeperProjectionsJson | null;
  projectionError: string | null;
};

/** What a sync reads from the database for one league. */
export type StoredGuillotineLeague = {
  format: GuillotineFormat;
  /** Sleeper owner ID -> member. */
  ownerToUserId: Map<string, string>;
  /**
   * The live week's stored scores. Only read when the projections could not
   * be fetched, so they can be kept.
   */
  liveWeekScores: { starters: string[]; starterProjections: number[] }[];
};

/** The weeks a sync asks Sleeper for, worked out from its league info. */
export function syncWeeks(info: SleeperLeagueInfoJson) {
  const lastScoredWeek = Math.min(
    info.settings?.last_scored_leg ?? 0,
    GUILLOTINE_FINAL_WEEK,
  );
  const throughWeek = weeksToSync({ status: info.status, lastScoredWeek });
  return {
    lastScoredWeek,
    throughWeek,
    weekNumbers: Array.from({ length: throughWeek }, (_, i) => i + 1),
    // The week still being played, if there is one: the only week
    // projections mean anything for.
    liveWeek: throughWeek > lastScoredWeek ? throughWeek : null,
  };
}

/**
 * Two legs can carry the same transaction at the boundary. The first copy is
 * kept, as the insert's skipDuplicates always did.
 */
function uniqueTransactions(transactions: SleeperTransaction[]) {
  const byId = new Map<string, SleeperTransaction>();
  for (const t of transactions) {
    if (!byId.has(t.transaction_id)) byId.set(t.transaction_id, t);
  }
  return [...byId.values()];
}

/**
 * Owners found from the draft or the transactions who are not in the
 * league's users list. They have usually left the league, so their names are
 * looked up one by one.
 */
export function departedOwners(
  data: Pick<GuillotineSleeperData, 'rosters' | 'users' | 'picks'> & {
    transactions: SleeperTransaction[];
  },
): string[] {
  const owners = resolveRosterOwners(
    data.rosters,
    data.picks,
    uniqueTransactions(data.transactions),
  );
  const known = new Set(data.users.map(user => user.user_id));
  return [...new Set(owners.values())].filter(
    (owner): owner is string => !!owner && !known.has(owner),
  );
}

/**
 * Everything one sync writes for a league, worked out from what Sleeper sent
 * and what is stored. No database or Sleeper access, so it can be tested with
 * plain data.
 */
export function planGuillotineSync(
  sleeper: GuillotineSleeperData,
  stored: StoredGuillotineLeague,
) {
  const { info, rosters, draft, picks, projections } = sleeper;
  const { lastScoredWeek, throughWeek, weekNumbers, liveWeek } =
    syncWeeks(info);
  const scoringSettings = info.scoring_settings ?? {};

  const chopRows = new Map<number, ChopWeekRow[]>(
    weekNumbers.map(week => [
      week,
      (sleeper.matchups.get(week) ?? []).map(row => ({
        rosterId: row.roster_id,
        points: row.points ?? 0,
        playerCount: row.players?.length ?? 0,
      })),
    ]),
  );

  const chops = resolveChops({
    format: stored.format,
    rosters: rosters.map(roster => ({
      rosterId: roster.roster_id,
      eliminated: roster.settings?.eliminated ?? null,
      hasPlayers: (roster.players?.length ?? 0) > 0,
    })),
    weeks: chopRows,
    lastScoredWeek,
  });

  // Counted twice, a transaction would weigh double in picking a roster's
  // owner from its moves.
  const transactions = uniqueTransactions(sleeper.transactions);
  const ownerByRoster = resolveRosterOwners(rosters, picks, transactions);
  const nameByOwner = new Map(
    [...sleeper.users, ...sleeper.departedUsers].map(user => [
      user.user_id,
      user.display_name ?? user.username,
    ]),
  );

  // The draft's own slot for each roster, so the board lines up with the
  // picks, which are filed by roster. Then the owner's slot, and the
  // first-round pick only for a draft Sleeper has no order for: a traded first
  // would give one roster two slots and leave another with none.
  const rosterSlot = new Map<number, number>();
  for (const [slot, rosterId] of Object.entries(
    draft?.slot_to_roster_id ?? {},
  )) {
    if (rosterId !== null) rosterSlot.set(rosterId, Number(slot));
  }
  const firstRoundSlot = new Map<number, number>();
  for (const pick of picks) {
    if (pick.round === 1 && !firstRoundSlot.has(pick.roster_id)) {
      firstRoundSlot.set(pick.roster_id, pick.pick_no);
    }
  }
  const draftSlotFor = (rosterId: number, ownerId: string | null) =>
    rosterSlot.get(rosterId) ??
    (ownerId ? draft?.draft_order?.[ownerId] : undefined) ??
    firstRoundSlot.get(rosterId) ??
    null;

  // If this sync could not load projections, keep the ones the last sync
  // stored for the live week rather than wiping them: one failed request
  // would otherwise project every starter yet to play at zero, and reorder
  // the chop line around it until the next sync.
  const keptProjections = new Map<string, number>();
  if (liveWeek && !projections) {
    for (const row of stored.liveWeekScores) {
      row.starters.forEach((starter, index) => {
        const projection = row.starterProjections[index];
        if (projection !== undefined) keptProjections.set(starter, projection);
      });
    }
  }
  const projectStarter = (starter: string | null) => {
    if (!starter) return 0;
    if (projections)
      return scoreProjection(projections[starter], scoringSettings);
    return keptProjections.get(starter) ?? 0;
  };

  const teams = rosters.map(roster => {
    const ownerId = ownerByRoster.get(roster.roster_id) ?? null;
    const choppedWeek = chops.choppedWeek.get(roster.roster_id) ?? null;
    const data = {
      sleeperOwnerId: ownerId,
      sleeperDisplayName: ownerId ? nameByOwner.get(ownerId) ?? null : null,
      // A roster nobody can be found for is assigned a member by hand on the
      // admin page, and a resync must not wipe that.
      ...(ownerId ? { userId: stored.ownerToUserId.get(ownerId) ?? null } : {}),
      draftSlot: draftSlotFor(roster.roster_id, ownerId),
      choppedWeek,
      finish: chops.finish.get(roster.roster_id) ?? null,
      waiverBudgetUsed: roster.settings?.waiver_budget_used ?? 0,
    };

    // Only the weeks the team was alive for: afterwards Sleeper keeps
    // reporting an empty roster scoring zero, which is not a score.
    const lastWeek = choppedWeek ?? throughWeek;
    const weekScores = weekNumbers
      .filter(week => week <= lastWeek)
      .flatMap(week => {
        const row = sleeper.matchups
          .get(week)
          ?.find(r => r.roster_id === roster.roster_id);
        if (!row) return [];
        const starters = weekStarters({
          matchupStarters: row.starters,
          rosterStarters: roster.starters,
          isLiveWeek: week === liveWeek,
        });
        return [
          {
            week,
            points: row.points ?? 0,
            starters,
            startingPlayerPoints: (row.starters_points ?? []).map(p => p ?? 0),
            players: row.players ?? [],
            starterProjections:
              week === liveWeek
                ? starters.map(s => projectStarter(s === '0' ? null : s))
                : [],
          },
        ];
      });

    return { rosterId: roster.roster_id, data, weekScores };
  });

  const warnings = [...chops.warnings];
  if (sleeper.projectionError) {
    warnings.push(
      `Week ${liveWeek} projections could not be loaded (${sleeper.projectionError}), so the chop line shows points only.`,
    );
  }

  return {
    league: {
      name: info.name,
      sleeperDraftId: draft?.draft_id ?? null,
      teamCount: info.total_rosters ?? rosters.length,
      waiverBudget: info.settings?.waiver_budget ?? 0,
      scoringSettings: info.scoring_settings ?? undefined,
      lastScoredWeek,
      isComplete: chops.championRosterId !== null,
    },
    teams,
    transactions: transactions.map(t => ({
      sleeperTransactionId: t.transaction_id,
      type: t.type,
      status: t.status,
      leg: t.leg,
      rosterIds: t.roster_ids,
      adds: t.adds ?? undefined,
      drops: t.drops ?? undefined,
      bid: t.settings?.waiver_bid ?? null,
      seq: t.settings?.seq ?? null,
      notes: t.metadata?.notes ?? null,
      processedAt: new Date(t.status_updated),
    })),
    draftPicks: picks.map(pick => ({
      pickNo: pick.pick_no,
      round: pick.round,
      rosterId: pick.roster_id,
      sleeperId: pick.player_id,
    })),
    warnings,
  };
}

export type GuillotineSyncPlan = ReturnType<typeof planGuillotineSync>;
