import {
  buildCareer,
  buildMatchLog,
  buildRun,
  isCupRound,
  seedingStanding,
  type CupCareer,
  type CupGameInput,
  type CupRound,
  type CupRun,
  type CupSide,
  type MatchLogRow,
} from './cupProfile';
import { CUP_FINAL_ROUND } from './shared.server';
import { prisma } from '~/db.server';
import { getCurrentSeason } from '~/models/season.server';

/**
 * The Cup half of a member's profile: every bracket run, their record and
 * seeding across them, and where they stand in this year's Cup if it is still
 * going.
 *
 * Cup scores are not stored. Each round is whatever the teams scored in their
 * league games during the weeks mapped to it, so they are read back from
 * `TeamGame` the same way the bracket page does it.
 */

export type CurrentCup =
  | {
      phase: 'seeding';
      year: number;
      rank: number;
      fieldSize: number;
      points: number;
      weeksPlayed: number;
      seedingWeeks: number;
    }
  | { phase: 'bracket'; run: CupRun };

export type CupProfile = {
  hasPlayed: boolean;
  career: CupCareer;
  /** Newest first. */
  runs: CupRun[];
  matchLog: MatchLogRow[];
  current: CurrentCup | null;
};

const sideSelect = {
  select: {
    id: true,
    seed: true,
    teamId: true,
    team: {
      select: { userId: true, user: { select: { discordName: true } } },
    },
  },
} as const;

const gameSelect = {
  select: {
    round: true,
    containsBye: true,
    winningTeamId: true,
    losingTeamId: true,
    topTeam: sideSelect,
    bottomTeam: sideSelect,
  },
} as const;

type SelectedSide = {
  id: string;
  seed: number;
  teamId: string;
  team: { userId: string | null; user: { discordName: string } | null };
} | null;

const toSide = (side: SelectedSide): CupSide | null =>
  side && {
    cupTeamId: side.id,
    teamId: side.teamId,
    seed: side.seed,
    userId: side.team.userId,
    name: side.team.user?.discordName || 'Unknown',
  };

export async function getCupProfile(userId: string): Promise<CupProfile> {
  const [cupTeams, currentCup] = await Promise.all([
    prisma.cupTeam.findMany({
      where: { team: { userId } },
      include: {
        cup: {
          select: {
            year: true,
            cupWeeks: { select: { week: true, mapping: true } },
            _count: { select: { cupTeams: true } },
          },
        },
        team: { select: { league: { select: { name: true } } } },
        TopTeamGames: gameSelect,
        BottomTeamGames: gameSelect,
      },
    }),
    getCurrentCup(),
  ]);

  // Every team whose score a run needs: the member's own, and each opponent's.
  const teamIds = new Set<string>();
  const weeks = new Set<number>();
  for (const cupTeam of cupTeams) {
    teamIds.add(cupTeam.teamId);
    for (const game of [...cupTeam.TopTeamGames, ...cupTeam.BottomTeamGames]) {
      if (game.topTeam) teamIds.add(game.topTeam.teamId);
      if (game.bottomTeam) teamIds.add(game.bottomTeam.teamId);
    }
    for (const cupWeek of cupTeam.cup.cupWeeks) weeks.add(cupWeek.week);
  }

  const teamGames =
    teamIds.size > 0
      ? await prisma.teamGame.findMany({
          where: { teamId: { in: [...teamIds] }, week: { in: [...weeks] } },
          select: {
            teamId: true,
            week: true,
            pointsScored: true,
            team: { select: { league: { select: { year: true } } } },
          },
        })
      : [];

  // Week -> mapping for each year, then each team's total per mapping. A team
  // belongs to one year, so its id alone is enough to key the totals.
  const mappingByYear = new Map<number, Map<number, string>>();
  for (const cupTeam of cupTeams) {
    mappingByYear.set(
      cupTeam.cup.year,
      new Map(cupTeam.cup.cupWeeks.map(w => [w.week, w.mapping])),
    );
  }

  const totals = new Map<string, number>();
  for (const game of teamGames) {
    const mapping = mappingByYear.get(game.team.league.year)?.get(game.week);
    if (!mapping) continue;
    const key = `${game.teamId}:${mapping}`;
    totals.set(key, (totals.get(key) ?? 0) + game.pointsScored);
  }

  const runs = cupTeams
    .map(cupTeam => {
      const weeksByRound = new Map<string, number>();
      for (const { mapping } of cupTeam.cup.cupWeeks) {
        weeksByRound.set(mapping, (weeksByRound.get(mapping) ?? 0) + 1);
      }

      const games: CupGameInput[] = [
        ...cupTeam.TopTeamGames,
        ...cupTeam.BottomTeamGames,
      ]
        .filter(game => isCupRound(game.round))
        .map(game => ({
          round: game.round,
          containsBye: game.containsBye,
          winningTeamId: game.winningTeamId,
          losingTeamId: game.losingTeamId,
          top: toSide(game.topTeam),
          bottom: toSide(game.bottomTeam),
        }));

      return buildRun({
        year: cupTeam.cup.year,
        leagueName: cupTeam.team.league.name,
        cupTeamId: cupTeam.id,
        teamId: cupTeam.teamId,
        seed: cupTeam.seed,
        fieldSize: cupTeam.cup._count.cupTeams,
        seedingPoints: totals.get(`${cupTeam.teamId}:SEEDING`) ?? null,
        games,
        scoreFor: (teamId: string, round: CupRound) =>
          totals.get(`${teamId}:${round}`) ?? null,
        weeksInRound: (round: CupRound) => weeksByRound.get(round) ?? 1,
      });
    })
    .sort((a, b) => b.year - a.year);

  // This year's Cup gets a banner until its final is decided: the live
  // seeding table before the bracket exists, and their run once it does.
  let current: CurrentCup | null = null;
  if (currentCup?.hasBracket) {
    const run = runs.find(r => r.year === currentCup.year);
    if (run && !currentCup.finalDecided) current = { phase: 'bracket', run };
  } else if (currentCup) {
    current = await getSeedingStanding(userId, currentCup);
  }

  return {
    hasPlayed: runs.length > 0,
    career: buildCareer(runs),
    runs,
    matchLog: buildMatchLog(runs),
    current,
  };
}

type CurrentCupState = {
  year: number;
  seedingWeeks: number[];
  hasBracket: boolean;
  finalDecided: boolean;
};

async function getCurrentCup(): Promise<CurrentCupState | null> {
  const season = await getCurrentSeason();
  if (!season) return null;

  const cup = await prisma.cup.findUnique({
    where: { year: season.year },
    select: {
      cupWeeks: { select: { week: true, mapping: true } },
      cupGames: {
        where: { round: CUP_FINAL_ROUND },
        select: { winningTeamId: true },
      },
      _count: { select: { cupTeams: true } },
    },
  });
  if (!cup) return null;

  return {
    year: season.year,
    seedingWeeks: cup.cupWeeks
      .filter(w => w.mapping === 'SEEDING')
      .map(w => w.week),
    hasBracket: cup._count.cupTeams > 0,
    finalDecided: cup.cupGames.some(game => game.winningTeamId !== null),
  };
}

/**
 * Where the member stands in this year's seeding, before the bracket exists,
 * ranked the way Set Seeds will rank them. Null before any seeding week has
 * been played, or when they have no team this year.
 */
async function getSeedingStanding(
  userId: string,
  cup: CurrentCupState,
): Promise<CurrentCup | null> {
  if (cup.seedingWeeks.length === 0) return null;

  const myTeam = await prisma.team.findFirst({
    where: { userId, league: { year: cup.year } },
    select: { id: true },
  });
  if (!myTeam) return null;

  const games = await prisma.teamGame.findMany({
    where: {
      week: { in: cup.seedingWeeks },
      team: { league: { year: cup.year } },
    },
    select: { teamId: true, week: true, pointsScored: true },
  });

  // Rows exist from the moment a week opens, so a week only counts once
  // somebody has scored in it.
  const weeksPlayed = new Set(
    games.filter(g => g.pointsScored > 0).map(g => g.week),
  );
  if (weeksPlayed.size === 0) return null;

  const byTeam = new Map<string, number>();
  for (const game of games) {
    byTeam.set(game.teamId, (byTeam.get(game.teamId) ?? 0) + game.pointsScored);
  }

  const standing = seedingStanding(
    Array.from(byTeam, ([teamId, points]) => ({ teamId, points })),
    myTeam.id,
  );
  if (!standing) return null;

  return {
    phase: 'seeding',
    year: cup.year,
    ...standing,
    weeksPlayed: weeksPlayed.size,
    seedingWeeks: cup.seedingWeeks.length,
  };
}
