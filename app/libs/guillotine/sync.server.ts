import {
  GUILLOTINE_FINAL_WEEK,
  resolveChops,
  resolveRosterOwners,
  weeksToSync,
} from './chops';
import type { ChopWeekRow } from './chops';
import { scoreProjection } from './projection';
import type { GuillotineLeague, Prisma } from '@prisma/client';
import { prisma } from '~/db.server';
import {
  getDraftPicksWithOwners,
  getGuillotineRosters,
  getLeagueDrafts,
  getLeagueInfo,
  getLeagueMatchups,
  getLeagueTransactions,
  getLeagueUsers,
  getProjections,
} from '~/libs/sleeper/api.server';
import { parseSleeperLeagueIdFromUrl } from '~/libs/sleeper/league-url';
import { getOwnerToUserIdMap } from '~/libs/sleeper/owners.server';
import type { SleeperMatchupJson } from '~/libs/sleeper/schemas';

export type GuillotineSyncResult = {
  warnings: string[];
  unmatchedTeams: number;
};

/** Sleeper's league type for its own guillotine format. */
const SLEEPER_GUILLOTINE_TYPE = 3;

/**
 * Adds a guillotine league from its Sleeper URL and backfills it. The year,
 * name and format all come from Sleeper, and the season is created the first
 * time a league for that year is added.
 */
export async function addGuillotineLeague(sleeperUrl: string) {
  const sleeperLeagueId = parseSleeperLeagueIdFromUrl(sleeperUrl);

  const existing = await prisma.guillotineLeague.findUnique({
    where: { sleeperLeagueId },
  });
  if (existing) {
    throw new Error(`"${existing.name}" has already been added.`);
  }

  const info = await getLeagueInfo(sleeperLeagueId);
  const year = Number(info.season);
  if (!Number.isInteger(year)) {
    throw new Error(`Sleeper did not say which season "${info.name}" is.`);
  }

  const season = await prisma.guillotineSeason.upsert({
    where: { year },
    update: {},
    create: { year },
  });

  const league = await prisma.guillotineLeague.create({
    data: {
      name: info.name,
      sleeperLeagueId,
      format:
        info.settings?.type === SLEEPER_GUILLOTINE_TYPE ? 'NATIVE' : 'MANUAL',
      teamCount: info.total_rosters ?? 0,
      guillotineSeasonId: season.id,
    },
  });

  // The league is kept even if its first sync fails, so the admin can retry
  // from its Sync button rather than add it again.
  try {
    const result = await syncGuillotineLeague(league);
    return { league, year, ...result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      league,
      year,
      warnings: [
        `The first sync failed (${message}). Press Sync to try again.`,
      ],
      unmatchedTeams: 0,
    };
  }
}

/**
 * Everything Sleeper has on one league - rosters, every week's scores, the chop
 * order, every transaction and the draft - replacing what is stored.
 *
 * This is the backfill and the live sync both. A league is 18 rosters over at
 * most 17 weeks, so a full pass is around 40 Sleeper requests: cheap enough to
 * run every five minutes while games are on, and it means a live sync can never
 * leave a league half-updated the way a week-only path could.
 *
 * @returns warnings for the admin (things the data could not settle), and how
 * many teams are not matched to a member yet.
 */
export async function syncGuillotineLeague(
  league: GuillotineLeague,
  ownerToUserId?: Map<string, string>,
): Promise<GuillotineSyncResult> {
  const id = league.sleeperLeagueId;
  const [info, rosters, users, drafts, owners] = await Promise.all([
    getLeagueInfo(id),
    getGuillotineRosters(id),
    getLeagueUsers(id),
    getLeagueDrafts(id),
    ownerToUserId ? Promise.resolve(ownerToUserId) : getOwnerToUserIdMap(),
  ]);

  const lastScoredWeek = Math.min(
    info.settings?.last_scored_leg ?? 0,
    GUILLOTINE_FINAL_WEEK,
  );
  const throughWeek = weeksToSync({ status: info.status, lastScoredWeek });
  const weekNumbers = Array.from({ length: throughWeek }, (_, i) => i + 1);

  // A league only ever has the one draft; take the finished one if there is
  // one, so a mock draft left lying around is never read instead.
  const draft =
    drafts.find(d => d.status === 'complete') ?? drafts[0] ?? undefined;

  // The week still being played, if there is one: the only week projections
  // mean anything for.
  const liveWeek = throughWeek > lastScoredWeek ? throughWeek : null;
  const scoringSettings = info.scoring_settings ?? {};

  let projectionError: string | null = null;
  const [matchups, transactions, picks, projections] = await Promise.all([
    Promise.all(weekNumbers.map(week => getLeagueMatchups(id, week))),
    Promise.all(weekNumbers.map(leg => getLeagueTransactions(id, leg))),
    draft ? getDraftPicksWithOwners(draft.draft_id) : Promise.resolve([]),
    // Projections are a nice-to-have on top of real scores, so a failed fetch
    // is reported rather than allowed to stop the league syncing.
    liveWeek && info.season
      ? getProjections(Number(info.season), liveWeek).catch((e: unknown) => {
          projectionError = e instanceof Error ? e.message : String(e);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const matchupsByWeek = new Map<number, SleeperMatchupJson>(
    weekNumbers.map((week, index) => [week, matchups[index]]),
  );
  const chopRows = new Map<number, ChopWeekRow[]>(
    [...matchupsByWeek].map(([week, rows]) => [
      week,
      rows.map(row => ({
        rosterId: row.roster_id,
        points: row.points ?? 0,
        playerCount: row.players?.length ?? 0,
      })),
    ]),
  );

  const chops = resolveChops({
    format: league.format,
    rosters: rosters.map(roster => ({
      rosterId: roster.roster_id,
      eliminated: roster.settings?.eliminated ?? null,
      hasPlayers: (roster.players?.length ?? 0) > 0,
    })),
    weeks: chopRows,
    lastScoredWeek,
  });

  const ownerByRoster = resolveRosterOwners(rosters, picks);
  const nameByOwner = new Map(
    users.map(user => [user.user_id, user.display_name ?? user.username]),
  );
  const draftSlotByRoster = new Map<number, number>();
  for (const pick of picks) {
    if (pick.round === 1) draftSlotByRoster.set(pick.roster_id, pick.pick_no);
  }

  const unmatchedTeams = [...ownerByRoster.values()].filter(
    owner => !owner || !owners.has(owner),
  ).length;

  const teamWrites = rosters.map(roster => {
    const ownerId = ownerByRoster.get(roster.roster_id) ?? null;
    const choppedWeek = chops.choppedWeek.get(roster.roster_id) ?? null;
    const teamData = {
      sleeperOwnerId: ownerId,
      sleeperDisplayName: ownerId ? nameByOwner.get(ownerId) ?? null : null,
      userId: ownerId ? owners.get(ownerId) ?? null : null,
      draftSlot: draftSlotByRoster.get(roster.roster_id) ?? null,
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
        const row = matchupsByWeek
          .get(week)
          ?.find(r => r.roster_id === roster.roster_id);
        if (!row) return [];
        return [
          {
            week,
            points: row.points ?? 0,
            starters: (row.starters ?? []).map(s => s ?? '0'),
            startingPlayerPoints: (row.starters_points ?? []).map(p => p ?? 0),
            players: row.players ?? [],
            starterProjections:
              week === liveWeek && projections
                ? (row.starters ?? []).map(starter =>
                    starter
                      ? scoreProjection(projections[starter], scoringSettings)
                      : 0,
                  )
                : [],
          },
        ];
      });

    return prisma.guillotineTeam.upsert({
      where: {
        guillotineLeagueId_rosterId: {
          guillotineLeagueId: league.id,
          rosterId: roster.roster_id,
        },
      },
      update: {
        ...teamData,
        weekScores: { deleteMany: {}, create: weekScores },
      },
      create: {
        ...teamData,
        rosterId: roster.roster_id,
        guillotineLeagueId: league.id,
        weekScores: { create: weekScores },
      },
    });
  });

  // One transaction, so a page never reads a league half rewritten.
  await prisma.$transaction([
    prisma.guillotineLeague.update({
      where: { id: league.id },
      data: {
        name: info.name,
        sleeperDraftId: draft?.draft_id ?? null,
        teamCount: info.total_rosters ?? rosters.length,
        waiverBudget: info.settings?.waiver_budget ?? 0,
        scoringSettings: info.scoring_settings ?? undefined,
        lastScoredWeek,
        isComplete: chops.championRosterId !== null,
        lastSyncedAt: new Date(),
      },
    }),
    ...teamWrites,
    prisma.guillotineTransaction.deleteMany({
      where: { guillotineLeagueId: league.id },
    }),
    prisma.guillotineTransaction.createMany({
      data: transactions.flat().map(t => ({
        guillotineLeagueId: league.id,
        sleeperTransactionId: t.transaction_id,
        type: t.type,
        status: t.status,
        leg: t.leg,
        rosterIds: t.roster_ids,
        adds: (t.adds ?? undefined) as Prisma.InputJsonValue | undefined,
        drops: (t.drops ?? undefined) as Prisma.InputJsonValue | undefined,
        bid: t.settings?.waiver_bid ?? null,
        seq: t.settings?.seq ?? null,
        notes: t.metadata?.notes ?? null,
        processedAt: new Date(t.status_updated),
      })),
      // Two legs can carry the same transaction at the boundary.
      skipDuplicates: true,
    }),
    prisma.guillotineDraftPick.deleteMany({
      where: { guillotineLeagueId: league.id },
    }),
    prisma.guillotineDraftPick.createMany({
      data: picks.map(pick => ({
        guillotineLeagueId: league.id,
        pickNo: pick.pick_no,
        round: pick.round,
        rosterId: pick.roster_id,
        sleeperId: pick.player_id,
      })),
    }),
  ]);

  const warnings = [...chops.warnings];
  if (projectionError) {
    warnings.push(
      `Week ${liveWeek} projections could not be loaded (${projectionError}), so the chop line shows points only.`,
    );
  }

  return { warnings, unmatchedTeams };
}

/**
 * Syncs every league of a year that is still running. The live score monitor
 * and the hourly job call this; finished leagues never change, so they are
 * left alone and only resynced from the admin page.
 *
 * Unmatched members are left out of what this returns: they are the admin
 * page's to show, and would otherwise be logged every five minutes.
 *
 * @returns one message per league that failed or could not settle its chops.
 */
export async function syncActiveGuillotineLeagues(
  year: number,
): Promise<string[]> {
  const leagues = await prisma.guillotineLeague.findMany({
    where: { season: { year }, isComplete: false },
  });
  if (leagues.length === 0) return [];

  // Read once for every league - it walks the whole member table.
  const owners = await getOwnerToUserIdMap();
  const messages: string[] = [];

  await Promise.all(
    leagues.map(async league => {
      try {
        const { warnings } = await syncGuillotineLeague(league, owners);
        messages.push(...warnings.map(w => `"${league.name}": ${w}`));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        messages.push(`"${league.name}": ${msg}`);
      }
    }),
  );

  return messages;
}
