import { prisma } from '~/db.server';
import {
  aggregateCareerStats,
  aggregateCupStats,
  aggregatePlayoffStats,
  averagePerSeason,
  computeStreak,
  pairTeamGames,
  winPct,
  type CareerStats,
} from '~/models/profile/shared.server';

const TOP_N = 50;
const MIN_SEASONS = 2;

export type RecordRow = {
  cells: string[];
  leagueName?: string;
  /// Set when the row belongs to one member, so the table can link the player
  /// cell to their profile. Rows that aggregate several members leave it unset.
  playerUserId?: string;
};

export type RecordTable = {
  title: string;
  headers: string[];
  rows: RecordRow[];
};

export async function getCareerRecords(): Promise<RecordTable[]> {
  const teams = await prisma.team.findMany({
    where: { userId: { not: null } },
    include: {
      user: { select: { discordName: true, id: true } },
    },
  });

  const careers = Array.from(aggregateCareerStats(teams).values());

  const avgPF = (c: CareerStats) => averagePerSeason(c.pointsFor, c.seasons);

  return [
    {
      title: 'Most Career Wins',
      headers: ['Player', 'Wins', 'Record', 'Seasons'],
      rows: [...careers]
        .sort((a, b) => b.wins - a.wins)
        .slice(0, TOP_N)
        .map(c => ({
          playerUserId: c.userId,
          cells: [
            c.name,
            c.wins.toString(),
            `${c.wins}-${c.losses}-${c.ties}`,
            c.seasons.toString(),
          ],
        })),
    },
    {
      title: 'Highest Career Win Percentage',
      headers: ['Player', 'Win %', 'Record', 'Seasons'],
      rows: [...careers]
        .filter(c => c.seasons >= MIN_SEASONS)
        .sort((a, b) => winPct(b) - winPct(a))
        .slice(0, TOP_N)
        .map(c => ({
          playerUserId: c.userId,
          cells: [
            c.name,
            (winPct(c) * 100).toFixed(1) + '%',
            `${c.wins}-${c.losses}-${c.ties}`,
            c.seasons.toString(),
          ],
        })),
    },
    {
      title: 'Most Career Points For',
      headers: ['Player', 'Points For', 'Avg/Season', 'Seasons'],
      rows: [...careers]
        .sort((a, b) => b.pointsFor - a.pointsFor)
        .slice(0, TOP_N)
        .map(c => ({
          playerUserId: c.userId,
          cells: [
            c.name,
            c.pointsFor.toFixed(2),
            avgPF(c).toFixed(2),
            c.seasons.toString(),
          ],
        })),
    },
    {
      title: 'Most Career Points Against',
      headers: ['Player', 'Points Against', 'Seasons'],
      rows: [...careers]
        .sort((a, b) => b.pointsAgainst - a.pointsAgainst)
        .slice(0, TOP_N)
        .map(c => ({
          playerUserId: c.userId,
          cells: [c.name, c.pointsAgainst.toFixed(2), c.seasons.toString()],
        })),
    },
    {
      title: 'Highest Average Points For per Season',
      headers: ['Player', 'Avg PF/Season', 'Total PF', 'Seasons'],
      rows: [...careers]
        .filter(c => c.seasons >= MIN_SEASONS)
        .sort((a, b) => avgPF(b) - avgPF(a))
        .slice(0, TOP_N)
        .map(c => ({
          playerUserId: c.userId,
          cells: [
            c.name,
            avgPF(c).toFixed(2),
            c.pointsFor.toFixed(2),
            c.seasons.toString(),
          ],
        })),
    },
    {
      title: 'Most Career Median Wins',
      headers: ['Player', 'Median Wins', 'Median Record', 'Seasons'],
      rows: [...careers]
        .sort((a, b) => b.medianWins - a.medianWins)
        .slice(0, TOP_N)
        .map(c => ({
          playerUserId: c.userId,
          cells: [
            c.name,
            c.medianWins.toString(),
            `${c.medianWins}-${c.medianLosses}-${c.medianTies}`,
            c.seasons.toString(),
          ],
        })),
    },
    {
      title: 'Most Seasons Played',
      headers: ['Player', 'Seasons', 'Career Record'],
      rows: [...careers]
        .sort((a, b) => b.seasons - a.seasons || b.wins - a.wins)
        .slice(0, TOP_N)
        .map(c => ({
          playerUserId: c.userId,
          cells: [
            c.name,
            c.seasons.toString(),
            `${c.wins}-${c.losses}-${c.ties}`,
          ],
        })),
    },
  ];
}

export async function getSingleSeasonRecords(): Promise<RecordTable[]> {
  const teams = await prisma.team.findMany({
    where: { userId: { not: null } },
    include: {
      user: { select: { discordName: true } },
      league: { select: { year: true, name: true } },
    },
  });

  const totalGames = (t: (typeof teams)[number]) => t.wins + t.losses + t.ties;
  const winPct = (t: (typeof teams)[number]) =>
    totalGames(t) > 0 ? t.wins / totalGames(t) : 0;
  const differential = (t: (typeof teams)[number]) =>
    t.pointsFor - t.pointsAgainst;

  const makeRow = (t: (typeof teams)[number], value: string): RecordRow => ({
    playerUserId: t.userId ?? undefined,
    cells: [
      t.user?.discordName || 'Unknown',
      value,
      t.league.year.toString(),
      t.league.name,
    ],
    leagueName: t.league.name.toLowerCase(),
  });

  return [
    {
      title: 'Most Wins in a Season',
      headers: ['Player', 'Record', 'Year', 'League'],
      rows: [...teams]
        .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)
        .slice(0, TOP_N)
        .map(t => makeRow(t, `${t.wins}-${t.losses}-${t.ties}`)),
    },
    {
      title: 'Best Win Percentage',
      headers: ['Player', 'Win %', 'Year', 'League'],
      rows: [...teams]
        .filter(t => totalGames(t) > 0)
        .sort((a, b) => winPct(b) - winPct(a))
        .slice(0, TOP_N)
        .map(t => makeRow(t, (winPct(t) * 100).toFixed(1) + '%')),
    },
    {
      title: 'Most Points For in a Season',
      headers: ['Player', 'Points For', 'Year', 'League'],
      rows: [...teams]
        .sort((a, b) => b.pointsFor - a.pointsFor)
        .slice(0, TOP_N)
        .map(t => makeRow(t, t.pointsFor.toFixed(2))),
    },
    {
      title: 'Most Points Against in a Season',
      headers: ['Player', 'Points Against', 'Year', 'League'],
      rows: [...teams]
        .sort((a, b) => b.pointsAgainst - a.pointsAgainst)
        .slice(0, TOP_N)
        .map(t => makeRow(t, t.pointsAgainst.toFixed(2))),
    },
    {
      title: 'Largest Points Differential (PF - PA)',
      headers: ['Player', 'Differential', 'Year', 'League'],
      rows: [...teams]
        .sort((a, b) => differential(b) - differential(a))
        .slice(0, TOP_N)
        .map(t =>
          makeRow(
            t,
            differential(t) > 0
              ? `+${differential(t).toFixed(2)}`
              : differential(t).toFixed(2),
          ),
        ),
    },
    {
      title: 'Most Median Wins in a Season',
      headers: ['Player', 'Median Record', 'Year', 'League'],
      rows: [...teams]
        .sort((a, b) => b.medianWins - a.medianWins)
        .slice(0, TOP_N)
        .map(t =>
          makeRow(t, `${t.medianWins}-${t.medianLosses}-${t.medianTies}`),
        ),
    },
  ];
}

export async function getSingleGameRecords(): Promise<RecordTable[]> {
  const [highestGames, lowestGames] = await Promise.all([
    prisma.teamGame.findMany({
      where: {
        isRegularSeason: true,
        team: { userId: { not: null } },
      },
      include: {
        team: {
          include: {
            user: { select: { discordName: true } },
            league: { select: { year: true, name: true } },
          },
        },
      },
      orderBy: { pointsScored: 'desc' },
      take: TOP_N,
    }),
    prisma.teamGame.findMany({
      where: {
        isRegularSeason: true,
        pointsScored: { gt: 0 },
        team: { userId: { not: null } },
      },
      include: {
        team: {
          include: {
            user: { select: { discordName: true } },
            league: { select: { year: true, name: true } },
          },
        },
      },
      orderBy: { pointsScored: 'asc' },
      take: TOP_N,
    }),
  ]);

  const makeRow = (
    g: (typeof highestGames)[number] | (typeof lowestGames)[number],
  ): RecordRow => ({
    playerUserId: g.team.userId ?? undefined,
    cells: [
      g.team.user?.discordName || 'Unknown',
      g.pointsScored.toFixed(2),
      `W${g.week}`,
      g.team.league.year.toString(),
      g.team.league.name,
    ],
    leagueName: g.team.league.name.toLowerCase(),
  });

  return [
    {
      title: 'Highest Score in a Single Week',
      headers: ['Player', 'Points', 'Week', 'Year', 'League'],
      rows: highestGames.map(makeRow),
    },
    {
      title: 'Lowest Score in a Single Week',
      headers: ['Player', 'Points', 'Week', 'Year', 'League'],
      rows: lowestGames.map(makeRow),
    },
  ];
}

export async function getCupRecords(): Promise<RecordTable[]> {
  const cupGames = await prisma.cupGame.findMany({
    where: {
      winningTeamId: { not: null },
    },
    include: {
      winningTeam: {
        include: {
          team: {
            include: {
              user: { select: { discordName: true, id: true } },
            },
          },
        },
      },
      topTeam: {
        include: {
          team: {
            include: {
              user: { select: { discordName: true, id: true } },
            },
          },
        },
      },
      bottomTeam: {
        include: {
          team: {
            include: {
              user: { select: { discordName: true, id: true } },
            },
          },
        },
      },
    },
  });

  const cupStats = Array.from(aggregateCupStats(cupGames).values());

  return [
    {
      title: 'Most Cup Championships',
      headers: ['Player', 'Championships', 'Finals', 'Games Won'],
      rows: [...cupStats]
        .sort(
          (a, b) =>
            b.championships - a.championships ||
            b.finalsAppearances - a.finalsAppearances,
        )
        .filter(c => c.championships > 0)
        .slice(0, TOP_N)
        .map(c => ({
          playerUserId: c.userId,
          cells: [
            c.name,
            c.championships.toString(),
            c.finalsAppearances.toString(),
            c.gameWins.toString(),
          ],
        })),
    },
    {
      title: 'Most Cup Finals Appearances',
      headers: ['Player', 'Finals', 'Championships', 'Games Won'],
      rows: [...cupStats]
        .filter(c => c.finalsAppearances > 0)
        .sort(
          (a, b) =>
            b.finalsAppearances - a.finalsAppearances ||
            b.championships - a.championships,
        )
        .slice(0, TOP_N)
        .map(c => ({
          playerUserId: c.userId,
          cells: [
            c.name,
            c.finalsAppearances.toString(),
            c.championships.toString(),
            c.gameWins.toString(),
          ],
        })),
    },
    {
      title: 'Most Cup Game Wins',
      headers: ['Player', 'Wins', 'Games Played', 'Win %'],
      rows: [...cupStats]
        .sort((a, b) => b.gameWins - a.gameWins)
        .slice(0, TOP_N)
        .map(c => ({
          playerUserId: c.userId,
          cells: [
            c.name,
            c.gameWins.toString(),
            c.gamesPlayed.toString(),
            c.gamesPlayed > 0
              ? ((c.gameWins / c.gamesPlayed) * 100).toFixed(1) + '%'
              : '0%',
          ],
        })),
    },
  ];
}

export async function getStreakRecords(): Promise<RecordTable[]> {
  const allGames = await prisma.teamGame.findMany({
    where: {
      isRegularSeason: true,
      pointsScored: { gt: 0 },
      team: { userId: { not: null } },
    },
    include: {
      team: {
        include: {
          user: { select: { discordName: true, id: true } },
          league: { select: { year: true, name: true, id: true } },
        },
      },
    },
  });

  // Sleeper reuses matchup ids each week, so pairing has to key on the week as
  // well as the league - see pairTeamGames.
  const gameResults = pairTeamGames(allGames).map(({ game, result }) => ({
    teamId: game.teamId,
    userName: game.team.user?.discordName || 'Unknown',
    userId: game.team.userId,
    year: game.team.league.year,
    week: game.week,
    pointsScored: game.pointsScored,
    leagueName: game.team.league.name,
    result,
  }));

  type GameResultRow = (typeof gameResults)[number];

  const teamGameMap = new Map<string, GameResultRow[]>();
  for (const result of gameResults) {
    const existing = teamGameMap.get(result.teamId);
    if (existing) {
      existing.push(result);
    } else {
      teamGameMap.set(result.teamId, [result]);
    }
  }

  for (const games of teamGameMap.values()) {
    games.sort((a, b) => a.week - b.week);
  }

  interface StreakInfo {
    userName: string;
    userId: string | null;
    year: number;
    leagueName: string;
    length: number;
    startWeek: number;
    endWeek: number;
  }

  function longestStreak(
    games: GameResultRow[],
    predicate: (game: GameResultRow) => boolean,
  ): StreakInfo | null {
    const streak = computeStreak(games, predicate);
    if (!streak) return null;

    return {
      userName: games[0].userName,
      userId: games[0].userId,
      year: games[0].year,
      leagueName: games[0].leagueName,
      length: streak.length,
      startWeek: games[streak.startIndex].week,
      endWeek: games[streak.endIndex].week,
    };
  }

  const winStreaks: StreakInfo[] = [];
  const lossStreaks: StreakInfo[] = [];
  const streak100: StreakInfo[] = [];

  for (const [, games] of teamGameMap) {
    const ws = longestStreak(games, g => g.result === 'W');
    if (ws) winStreaks.push(ws);

    const ls = longestStreak(games, g => g.result === 'L');
    if (ls) lossStreaks.push(ls);

    const s100 = longestStreak(games, g => g.pointsScored >= 100);
    if (s100) streak100.push(s100);
  }

  winStreaks.sort((a, b) => b.length - a.length);
  lossStreaks.sort((a, b) => b.length - a.length);
  streak100.sort((a, b) => b.length - a.length);

  const makeStreakRows = (streaks: StreakInfo[]): RecordRow[] =>
    streaks.slice(0, TOP_N).map(s => ({
      playerUserId: s.userId ?? undefined,
      cells: [
        s.userName,
        s.length.toString(),
        `${s.year} W${s.startWeek}${
          s.startWeek !== s.endWeek ? `-W${s.endWeek}` : ''
        }`,
        s.leagueName,
      ],
      leagueName: s.leagueName.toLowerCase(),
    }));

  return [
    {
      title: 'Longest Win Streak',
      headers: ['Player', 'Games', 'Span', 'League'],
      rows: makeStreakRows(winStreaks),
    },
    {
      title: 'Longest Losing Streak',
      headers: ['Player', 'Games', 'Span', 'League'],
      rows: makeStreakRows(lossStreaks),
    },
    {
      title: 'Longest 100+ Point Streak',
      headers: ['Player', 'Games', 'Span', 'League'],
      rows: makeStreakRows(streak100),
    },
  ];
}

/**
 * League postseason records, built from the synced brackets.
 *
 * Only games flagged `countsTowardRecord` move a playoff win/loss record, so
 * placement games like the third-place game are excluded - consistent with how
 * the league counts them.
 */
export async function getPlayoffRecords(): Promise<RecordTable[]> {
  const games = await prisma.playoffGame.findMany({
    include: {
      topTeam: {
        select: { userId: true, user: { select: { discordName: true } } },
      },
      bottomTeam: {
        select: { userId: true, user: { select: { discordName: true } } },
      },
      winningTeam: {
        select: { userId: true, user: { select: { discordName: true } } },
      },
      advancingTeam: {
        select: { userId: true, user: { select: { discordName: true } } },
      },
    },
  });

  const stats = Array.from(aggregatePlayoffStats(games).values());

  const playoffWinPct = (s: (typeof stats)[number]) => {
    const played = s.wins + s.losses;
    return played > 0 ? ((s.wins / played) * 100).toFixed(1) + '%' : '0%';
  };

  return [
    {
      title: 'Most League Championships',
      headers: ['Player', 'Championships', 'Playoff Record', 'Appearances'],
      rows: [...stats]
        .filter(s => s.championships > 0)
        .sort((a, b) => b.championships - a.championships || b.wins - a.wins)
        .slice(0, TOP_N)
        .map(s => ({
          playerUserId: s.userId,
          cells: [
            s.name,
            s.championships.toString(),
            `${s.wins}-${s.losses}`,
            s.appearances.toString(),
          ],
        })),
    },
    {
      title: 'Most Playoff Appearances',
      headers: ['Player', 'Appearances', 'Playoff Record', 'Championships'],
      rows: [...stats]
        .filter(s => s.appearances > 0)
        .sort(
          (a, b) =>
            b.appearances - a.appearances || b.championships - a.championships,
        )
        .slice(0, TOP_N)
        .map(s => ({
          playerUserId: s.userId,
          cells: [
            s.name,
            s.appearances.toString(),
            `${s.wins}-${s.losses}`,
            s.championships.toString(),
          ],
        })),
    },
    {
      title: 'Most Playoff Wins',
      headers: ['Player', 'Wins', 'Playoff Record', 'Win %'],
      rows: [...stats]
        .filter(s => s.wins > 0)
        .sort((a, b) => b.wins - a.wins || a.losses - b.losses)
        .slice(0, TOP_N)
        .map(s => ({
          playerUserId: s.userId,
          cells: [
            s.name,
            s.wins.toString(),
            `${s.wins}-${s.losses}`,
            playoffWinPct(s),
          ],
        })),
    },
    {
      title: 'Most Sackos',
      headers: ['Player', 'Sackos', 'Championships', 'Appearances'],
      rows: [...stats]
        .filter(s => s.sackos > 0)
        .sort((a, b) => b.sackos - a.sackos)
        .slice(0, TOP_N)
        .map(s => ({
          playerUserId: s.userId,
          cells: [
            s.name,
            s.sackos.toString(),
            s.championships.toString(),
            s.appearances.toString(),
          ],
        })),
    },
  ];
}
