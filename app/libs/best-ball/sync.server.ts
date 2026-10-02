import {
  BEST_BALL_FINAL_WEEK,
  isSeasonComplete,
  rankByPointsFor,
  resolveRosterOwners,
  roundPoints,
  weeksToSync,
} from './views';
import type { BestBallLeague } from '@prisma/client';
import { prisma } from '~/db.server';
import type { ActiveSyncReport } from '~/libs/guillotine/sync.server';
import {
  getBestBallDraftPicks,
  getGuillotineRosters,
  getLeagueDrafts,
  getLeagueInfo,
  getLeagueMatchups,
  getLeagueUsers,
  getSleeperUser,
} from '~/libs/sleeper/api.server';
import { bestBallLineup } from '~/libs/sleeper/best-ball';
import { parseSleeperLeagueIdFromUrl } from '~/libs/sleeper/league-url';
import { getOwnerToUserIdMap } from '~/libs/sleeper/owners.server';
import { getPlayersBySleepersIds } from '~/models/players.server';

export type BestBallSyncResult = {
  warnings: string[];
  unmatchedTeams: number;
};

/**
 * Adds the year's best ball league from its Sleeper URL and backfills it. The
 * year and name come from Sleeper, and the season is created with it. A season
 * holds one league, so a second league for a year is refused.
 */
export async function addBestBallLeague(sleeperUrl: string) {
  const sleeperLeagueId = parseSleeperLeagueIdFromUrl(sleeperUrl);

  const existing = await prisma.bestBallLeague.findUnique({
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

  const taken = await prisma.bestBallLeague.findFirst({
    where: { season: { year } },
  });
  if (taken) {
    throw new Error(
      `${year} already has "${taken.name}". Delete it first to replace it.`,
    );
  }

  const season = await prisma.bestBallSeason.upsert({
    where: { year },
    update: {},
    create: { year },
  });

  const league = await prisma.bestBallLeague.create({
    data: {
      name: info.name,
      sleeperLeagueId,
      teamCount: info.total_rosters ?? 0,
      bestBallSeasonId: season.id,
    },
  });

  // The league is kept even if its first sync fails, so the admin can retry
  // from its Sync button rather than add it again.
  try {
    const result = await syncBestBallLeague(league);
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
 * Everything Sleeper has on the league - rosters, the draft, and every week's
 * best-ball score through week 17 - replacing what is stored.
 *
 * Each week is scored here from the whole roster's points rather than read off
 * Sleeper: its matchup `points` only sums the frozen starters, which reads far
 * too low while a week is being played. See app/libs/sleeper/best-ball.ts.
 *
 * @returns warnings for the admin, and how many teams are not matched to a
 * member yet.
 */
export async function syncBestBallLeague(
  league: BestBallLeague,
  ownerToUserId?: Map<string, string>,
): Promise<BestBallSyncResult> {
  const id = league.sleeperLeagueId;
  const [info, rosters, users, drafts, owners] = await Promise.all([
    getLeagueInfo(id),
    getGuillotineRosters(id),
    getLeagueUsers(id),
    getLeagueDrafts(id),
    ownerToUserId ? Promise.resolve(ownerToUserId) : getOwnerToUserIdMap(),
  ]);

  const lastScoredLeg = info.settings?.last_scored_leg ?? 0;
  const lastScoredWeek = Math.min(lastScoredLeg, BEST_BALL_FINAL_WEEK);
  const throughWeek = weeksToSync({ status: info.status, lastScoredWeek });
  const weekNumbers = Array.from({ length: throughWeek }, (_, i) => i + 1);
  const isComplete = isSeasonComplete({ status: info.status, lastScoredLeg });

  // Take the finished draft, so a mock draft left lying around is never read.
  const draft =
    drafts.find(d => d.status === 'complete') ?? drafts[0] ?? undefined;

  const [matchups, picks] = await Promise.all([
    Promise.all(weekNumbers.map(week => getLeagueMatchups(id, week))),
    draft ? getBestBallDraftPicks(draft.draft_id) : Promise.resolve([]),
  ]);

  // Positions for the lineup: our player table first, since Sleeper scores a
  // player at his position now, then the draft's record of him for anyone
  // the table is missing.
  const rosterPositions = info.roster_positions ?? [];
  const sleeperIds = new Set([
    ...picks.map(p => p.player_id),
    ...matchups.flatMap(week =>
      week.flatMap(row => Object.keys(row.players_points ?? {})),
    ),
  ]);
  const positionBySleeperId = new Map<string, string | null>();
  for (const pick of picks) {
    positionBySleeperId.set(pick.player_id, pick.metadata?.position ?? null);
  }
  for (const player of await getPlayersBySleepersIds([...sleeperIds])) {
    if (player.position) {
      positionBySleeperId.set(player.sleeperId, player.position);
    }
  }

  const warnings: string[] = [];
  if (rosterPositions.length === 0 && weekNumbers.length > 0) {
    warnings.push(
      'Sleeper sent no roster positions, so weeks were scored from its own starters instead of best ball.',
    );
  }
  const unplaceable = new Set<string>();
  const unknownSlots = new Set<string>();

  // Roster ID -> its week scores.
  const scoresByRoster = new Map<
    number,
    {
      week: number;
      points: number;
      starters: string[];
      startingPlayerPoints: number[];
    }[]
  >();
  weekNumbers.forEach((week, index) => {
    // The week in progress before its first kickoff: every roster on zero,
    // which is no score yet rather than a score of nothing.
    const unplayed =
      week > lastScoredWeek &&
      matchups[index].every(row =>
        Object.values(row.players_points ?? {}).every(p => !p),
      );
    if (unplayed) return;
    for (const row of matchups[index]) {
      let score;
      if (rosterPositions.length > 0 && row.players_points) {
        const lineup = bestBallLineup({
          rosterPositions,
          playersPoints: row.players_points,
          positionBySleeperId,
        });
        lineup.unplaceable.forEach(p => unplaceable.add(p));
        lineup.unknownSlots.forEach(s => unknownSlots.add(s));
        score = {
          week,
          points: lineup.points,
          starters: lineup.starters,
          startingPlayerPoints: lineup.startingPlayerPoints,
        };
      } else {
        score = {
          week,
          points: row.points ?? 0,
          starters: (row.starters ?? []).map(s => s ?? '0'),
          startingPlayerPoints: (row.starters_points ?? []).map(p => p ?? 0),
        };
      }
      const list = scoresByRoster.get(row.roster_id) ?? [];
      list.push(score);
      scoresByRoster.set(row.roster_id, list);
    }
  });
  if (unplaceable.size > 0) {
    warnings.push(
      `${
        unplaceable.size
      } player(s) scored but have no position on record, so their points were left out: ${[
        ...unplaceable,
      ].join(', ')}. Syncing NFL players should fix this.`,
    );
  }
  if (unknownSlots.size > 0) {
    warnings.push(
      `Unrecognised lineup slot(s) ${[...unknownSlots].join(
        ', ',
      )} were left empty, so totals are low.`,
    );
  }

  const ownerByRoster = resolveRosterOwners(rosters, picks);
  const nameByOwner = new Map(
    users.map(user => [user.user_id, user.display_name ?? user.username]),
  );
  // A manager who has left the league is not in its users list; look them up
  // one by one, where a failed lookup only costs the name.
  const departed = [...new Set(ownerByRoster.values())].filter(
    (owner): owner is string => !!owner && !nameByOwner.has(owner),
  );
  const departedUsers = await Promise.all(
    departed.map(owner => getSleeperUser(owner).catch(() => null)),
  );
  for (const user of departedUsers) {
    if (user) nameByOwner.set(user.user_id, user.display_name ?? user.username);
  }

  const slotByRoster = new Map<number, number>();
  for (const pick of picks) {
    if (pick.round === 1) slotByRoster.set(pick.roster_id, pick.draft_slot);
  }
  const draftSlotFor = (rosterId: number, ownerId: string | null) =>
    (ownerId ? draft?.draft_order?.[ownerId] : undefined) ??
    slotByRoster.get(rosterId) ??
    null;

  const totals = rosters.map(roster => ({
    rosterId: roster.roster_id,
    pointsFor: roundPoints(
      (scoresByRoster.get(roster.roster_id) ?? []).reduce(
        (sum, s) => sum + s.points,
        0,
      ),
    ),
  }));
  const finishByRoster = new Map(
    isComplete
      ? rankByPointsFor(totals).map(t => [t.rosterId, t.rank] as const)
      : [],
  );
  const pointsByRoster = new Map(totals.map(t => [t.rosterId, t.pointsFor]));

  const teamWrites = rosters.map(roster => {
    const ownerId = ownerByRoster.get(roster.roster_id) ?? null;
    const weekScores = scoresByRoster.get(roster.roster_id) ?? [];
    const teamData = {
      sleeperOwnerId: ownerId,
      sleeperDisplayName: ownerId ? nameByOwner.get(ownerId) ?? null : null,
      // A roster nobody can be found for is assigned a member by hand on the
      // admin page, and a resync must not wipe that.
      ...(ownerId ? { userId: owners.get(ownerId) ?? null } : {}),
      draftSlot: draftSlotFor(roster.roster_id, ownerId),
      pointsFor: pointsByRoster.get(roster.roster_id) ?? 0,
      finish: finishByRoster.get(roster.roster_id) ?? null,
    };
    return prisma.bestBallTeam.upsert({
      where: {
        bestBallLeagueId_rosterId: {
          bestBallLeagueId: league.id,
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
        bestBallLeagueId: league.id,
        weekScores: { create: weekScores },
      },
    });
  });

  // One transaction, so a page never reads a league half rewritten. The live
  // monitor and the hourly job can sync the league in the same minute, so the
  // transaction first takes a lock on it and the second one waits.
  await prisma.$transaction([
    prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${league.id}))`,
    prisma.bestBallLeague.update({
      where: { id: league.id },
      data: {
        name: info.name,
        sleeperDraftId: draft?.draft_id ?? null,
        teamCount: info.total_rosters ?? rosters.length,
        lastScoredWeek,
        isComplete,
        lastSyncedAt: new Date(),
      },
    }),
    ...teamWrites,
    prisma.bestBallDraftPick.deleteMany({
      where: { bestBallLeagueId: league.id },
    }),
    prisma.bestBallDraftPick.createMany({
      data: picks.map(pick => {
        const name = [pick.metadata?.first_name, pick.metadata?.last_name]
          .filter(Boolean)
          .join(' ');
        return {
          bestBallLeagueId: league.id,
          pickNo: pick.pick_no,
          round: pick.round,
          draftSlot: pick.draft_slot,
          rosterId: pick.roster_id,
          sleeperId: pick.player_id,
          position: pick.metadata?.position || '?',
          playerName: name || pick.player_id,
          nflTeam: pick.metadata?.team || null,
        };
      }),
    }),
  ]);

  // Read back rather than worked out, so rosters assigned by hand count.
  const unmatchedTeams = await prisma.bestBallTeam.count({
    where: { bestBallLeagueId: league.id, userId: null },
  });

  return { warnings, unmatchedTeams };
}

/**
 * Syncs the year's league if it is still running. The live score monitor and
 * the hourly job call this; a finished league never changes, so it is left
 * alone and only resynced from the admin page.
 *
 * @returns an error if the league failed to sync, or its warnings if it
 * synced, each prefixed with the league's name.
 */
export async function syncActiveBestBallLeagues(
  year: number,
): Promise<ActiveSyncReport> {
  const report: ActiveSyncReport = { errors: [], warnings: [] };
  const leagues = await prisma.bestBallLeague.findMany({
    where: { season: { year }, isComplete: false },
  });
  if (leagues.length === 0) return report;

  const owners = await getOwnerToUserIdMap();
  for (const league of leagues) {
    try {
      const { warnings } = await syncBestBallLeague(league, owners);
      report.warnings.push(...warnings.map(w => `"${league.name}": ${w}`));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report.errors.push(`"${league.name}": ${msg}`);
    }
  }
  return report;
}
