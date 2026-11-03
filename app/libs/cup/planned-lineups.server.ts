import { chooseLineup } from './lineups';
import { prisma } from '~/db.server';
import { getLeagueInfo, getLeagueMatchups } from '~/libs/sleeper/api.server';
import { EMPTY_SLOT } from '~/libs/sleeper/best-ball';
import { getCupByYear } from '~/models/cup.server';
import { getCupWeeks } from '~/models/cupweek.server';
import { getLeaguesByYear } from '~/models/league.server';
import { getCurrentNflWeek } from '~/models/nflgame.server';
import { getPlayersBySleepersIds } from '~/models/players.server';

/**
 * The cup weeks worth planning a lineup for: this NFL week and the next, as
 * far as Sleeper's projections are kept, and only until their games begin. A
 * week's scores sync takes over from there.
 */
async function getUpcomingCupWeeks(year: number, now: Date) {
  const [cup, currentWeek] = await Promise.all([
    getCupByYear(year),
    getCurrentNflWeek(year, now),
  ]);
  if (!cup || !currentWeek) return [];

  const candidates = (await getCupWeeks(cup.id))
    .filter(cupWeek => cupWeek.mapping !== 'SEEDING')
    .map(cupWeek => cupWeek.week)
    .filter(week => week === currentWeek || week === currentWeek + 1);
  const started = await prisma.nFLGame.findMany({
    where: { year, week: { in: candidates }, status: { not: 'pre_game' } },
    distinct: ['week'],
    select: { week: true },
  });
  return candidates.filter(week => !started.some(game => game.week === week));
}

/** Sleeper's projections for these players, by week and then Sleeper ID. */
async function getProjectionsBySleeperId(
  year: number,
  weeks: number[],
  sleeperIds: string[],
) {
  const scores = await prisma.playerWeekScore.findMany({
    where: {
      year,
      week: { in: weeks },
      projection: { not: null },
      player: { sleeperId: { in: sleeperIds } },
    },
    select: {
      week: true,
      projection: true,
      player: { select: { sleeperId: true } },
    },
  });
  const byWeek = new Map(weeks.map(week => [week, new Map<string, number>()]));
  for (const { week, projection, player } of scores) {
    byWeek.get(week)?.set(player.sleeperId, projection!);
  }
  return byWeek;
}

/** The NFL teams playing in each of these weeks, by week. */
async function getNflTeamsPlaying(year: number, weeks: number[]) {
  const games = await prisma.nFLGame.findMany({
    where: { year, week: { in: weeks } },
    select: {
      week: true,
      homeTeam: { select: { sleeperId: true } },
      awayTeam: { select: { sleeperId: true } },
    },
  });
  const byWeek = new Map(weeks.map(week => [week, new Set<string>()]));
  for (const { week, homeTeam, awayTeam } of games) {
    byWeek.get(week)?.add(homeTeam.sleeperId).add(awayTeam.sleeperId);
  }
  return byWeek;
}

/**
 * Stores every team's planned lineup for the cup weeks coming up. Makes no
 * Sleeper calls outside them.
 */
export async function syncPlannedCupLineups(year: number, now = new Date()) {
  const weeks = await getUpcomingCupWeeks(year, now);
  if (weeks.length === 0) return { weeks, lineups: 0, optimal: 0 };

  const leagues = await getLeaguesByYear(year);
  const fetched = await Promise.all(
    leagues.map(async league => {
      const [info, matchups] = await Promise.all([
        getLeagueInfo(league.sleeperLeagueId),
        Promise.all(
          weeks.map(async week => ({
            week,
            rows: await getLeagueMatchups(league.sleeperLeagueId, week),
          })),
        ),
      ]);
      return {
        league,
        rosterPositions: info.roster_positions ?? [],
        matchups,
      };
    }),
  );

  const rosterIds = [
    ...new Set(
      fetched.flatMap(({ matchups }) =>
        matchups.flatMap(({ rows }) => rows.flatMap(row => row.players ?? [])),
      ),
    ),
  ];
  const [players, projections, teamsPlaying] = await Promise.all([
    getPlayersBySleepersIds(rosterIds),
    getProjectionsBySleeperId(year, weeks, rosterIds),
    getNflTeamsPlaying(year, weeks),
  ]);
  const playerBySleeperId = new Map(players.map(p => [p.sleeperId, p]));
  const positionBySleeperId = new Map(
    players.map(player => [player.sleeperId, player.position]),
  );

  const lineups = fetched.flatMap(({ league, rosterPositions, matchups }) =>
    matchups.flatMap(({ week, rows }) =>
      rows.flatMap(row => {
        const team = league.teams.find(t => t.rosterId === row.roster_id);
        if (!team) return [];
        const lineup = chooseLineup({
          starters: (row.starters ?? []).map(id => id ?? EMPTY_SLOT),
          players: row.players ?? [],
          rosterPositions,
          projectionBySleeperId: projections.get(week)!,
          positionBySleeperId,
          hasGame: sleeperId => {
            const player = playerBySleeperId.get(sleeperId);
            // A defense's Sleeper ID is its team abbreviation.
            const nflTeam = player ? player.nflTeam : sleeperId;
            return !!nflTeam && teamsPlaying.get(week)!.has(nflTeam);
          },
        });
        return lineup ? [{ teamId: team.id, week, ...lineup }] : [];
      }),
    ),
  );

  await prisma.$transaction([
    prisma.teamPlannedLineup.deleteMany({
      where: {
        week: { in: weeks },
        teamId: { in: lineups.map(lineup => lineup.teamId) },
      },
    }),
    prisma.teamPlannedLineup.createMany({ data: lineups }),
  ]);

  return {
    weeks,
    lineups: lineups.length,
    optimal: lineups.filter(lineup => lineup.isOptimal).length,
  };
}
