import { departedOwners, planGuillotineSync, syncWeeks } from './plan';
import type { GuillotineSyncPlan } from './plan';
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
  getSleeperUser,
} from '~/libs/sleeper/api.server';
import { parseSleeperLeagueIdFromUrl } from '~/libs/sleeper/league-url';
import { getOwnerToUserIdMap } from '~/libs/sleeper/owners.server';

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
  const { weekNumbers, liveWeek } = syncWeeks(info);

  // A league only ever has the one draft; take the finished one if there is
  // one, so a mock draft left lying around is never read instead.
  const draft =
    drafts.find(d => d.status === 'complete') ?? drafts[0] ?? undefined;

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

  const allTransactions = transactions.flat();

  // A failed lookup of a departed owner only costs the name.
  const departedUsers = await Promise.all(
    departedOwners({
      rosters,
      users,
      picks,
      transactions: allTransactions,
    }).map(owner => getSleeperUser(owner).catch(() => null)),
  );

  const liveWeekScores =
    liveWeek && !projections
      ? await prisma.guillotineWeekScore.findMany({
          where: { week: liveWeek, team: { guillotineLeagueId: league.id } },
          select: { starters: true, starterProjections: true },
        })
      : [];

  const plan = planGuillotineSync(
    {
      info,
      rosters,
      users,
      departedUsers: departedUsers.filter(user => user !== null),
      draft,
      matchups: new Map(
        weekNumbers.map((week, index) => [week, matchups[index]]),
      ),
      transactions: allTransactions,
      picks,
      projections,
      projectionError,
    },
    { format: league.format, ownerToUserId: owners, liveWeekScores },
  );

  await writeGuillotineSync(league.id, plan);

  // Read back rather than worked out, so rosters assigned by hand count.
  const unmatchedTeams = await prisma.guillotineTeam.count({
    where: { guillotineLeagueId: league.id, userId: null },
  });

  return { warnings: plan.warnings, unmatchedTeams };
}

/**
 * Replaces what is stored for a league with a plan's writes.
 *
 * One transaction, so a page never reads a league half rewritten. The live
 * monitor and the hourly job can both sync a league in the same minute, and
 * two rewrites interleaving would trip over each other's inserts, so the
 * transaction first takes a lock on this league and the second one waits.
 */
async function writeGuillotineSync(
  guillotineLeagueId: string,
  plan: GuillotineSyncPlan,
) {
  await prisma.$transaction([
    prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${guillotineLeagueId}))`,
    prisma.guillotineLeague.update({
      where: { id: guillotineLeagueId },
      data: { ...plan.league, lastSyncedAt: new Date() },
    }),
    ...plan.teams.map(({ rosterId, data, weekScores }) =>
      prisma.guillotineTeam.upsert({
        where: {
          guillotineLeagueId_rosterId: { guillotineLeagueId, rosterId },
        },
        update: {
          ...data,
          weekScores: { deleteMany: {}, create: weekScores },
        },
        create: {
          ...data,
          rosterId,
          guillotineLeagueId,
          weekScores: { create: weekScores },
        },
      }),
    ),
    prisma.guillotineTransaction.deleteMany({ where: { guillotineLeagueId } }),
    prisma.guillotineTransaction.createMany({
      data: plan.transactions.map(t => ({
        ...t,
        guillotineLeagueId,
        adds: t.adds as Prisma.InputJsonValue | undefined,
        drops: t.drops as Prisma.InputJsonValue | undefined,
      })),
    }),
    prisma.guillotineDraftPick.deleteMany({ where: { guillotineLeagueId } }),
    prisma.guillotineDraftPick.createMany({
      data: plan.draftPicks.map(pick => ({ ...pick, guillotineLeagueId })),
    }),
  ]);
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
