import { prisma } from '~/db.server';

const TOP_N = 50;
const MIN_SEASONS = 2;

export type RecordRow = {
  cells: string[];
  leagueName?: string;
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

  interface CareerStats {
    name: string;
    seasons: number;
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
    medianWins: number;
    medianLosses: number;
    medianTies: number;
  }

  const map = new Map<string, CareerStats>();

  for (const team of teams) {
    if (!team.userId) continue;
    const existing = map.get(team.userId) || {
      name: team.user?.discordName || 'Unknown',
      seasons: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      medianWins: 0,
      medianLosses: 0,
      medianTies: 0,
    };
    existing.seasons++;
    existing.wins += team.wins;
    existing.losses += team.losses;
    existing.ties += team.ties;
    existing.pointsFor += team.pointsFor;
    existing.pointsAgainst += team.pointsAgainst;
    existing.medianWins += team.medianWins;
    existing.medianLosses += team.medianLosses;
    existing.medianTies += team.medianTies;
    map.set(team.userId, existing);
  }

  const careers = Array.from(map.values());

  const totalGames = (c: CareerStats) => c.wins + c.losses + c.ties;
  const winPct = (c: CareerStats) =>
    totalGames(c) > 0 ? c.wins / totalGames(c) : 0;
  const avgPF = (c: CareerStats) =>
    c.seasons > 0 ? c.pointsFor / c.seasons : 0;

  return [
    {
      title: 'Most Career Wins',
      headers: ['Player', 'Wins', 'Record', 'Seasons'],
      rows: [...careers]
        .sort((a, b) => b.wins - a.wins)
        .slice(0, TOP_N)
        .map(c => ({
          cells: [
            c.name,
            c.wins.toString(),
            `${c.wins}-${c.losses}-${c.ties}`,
            c.seasons.toString(),
          ],
        })),
    },
    {
      title: 'Most Career Losses',
      headers: ['Player', 'Losses', 'Record', 'Seasons'],
      rows: [...careers]
        .sort((a, b) => b.losses - a.losses)
        .slice(0, TOP_N)
        .map(c => ({
          cells: [
            c.name,
            c.losses.toString(),
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

  interface CupStats {
    name: string;
    championships: number;
    finalsAppearances: number;
    gameWins: number;
    gamesPlayed: number;
  }

  const cupStatsMap = new Map<string, CupStats>();

  const getOrCreate = (userId: string, name: string): CupStats => {
    if (!cupStatsMap.has(userId)) {
      cupStatsMap.set(userId, {
        name,
        championships: 0,
        finalsAppearances: 0,
        gameWins: 0,
        gamesPlayed: 0,
      });
    }
    return cupStatsMap.get(userId)!;
  };

  for (const game of cupGames) {
    if (game.topTeam?.team.userId) {
      const stats = getOrCreate(
        game.topTeam.team.userId,
        game.topTeam.team.user?.discordName || 'Unknown',
      );
      stats.gamesPlayed++;
    }
    if (game.bottomTeam?.team.userId) {
      const stats = getOrCreate(
        game.bottomTeam.team.userId,
        game.bottomTeam.team.user?.discordName || 'Unknown',
      );
      stats.gamesPlayed++;
    }
    if (game.winningTeam?.team.userId) {
      const stats = getOrCreate(
        game.winningTeam.team.userId,
        game.winningTeam.team.user?.discordName || 'Unknown',
      );
      stats.gameWins++;
    }
    if (game.round === 'ROUND_OF_2') {
      if (game.topTeam?.team.userId) {
        getOrCreate(
          game.topTeam.team.userId,
          game.topTeam.team.user?.discordName || 'Unknown',
        ).finalsAppearances++;
      }
      if (game.bottomTeam?.team.userId) {
        getOrCreate(
          game.bottomTeam.team.userId,
          game.bottomTeam.team.user?.discordName || 'Unknown',
        ).finalsAppearances++;
      }
      if (game.winningTeam?.team.userId) {
        getOrCreate(
          game.winningTeam.team.userId,
          game.winningTeam.team.user?.discordName || 'Unknown',
        ).championships++;
      }
    }
  }

  const cupStats = Array.from(cupStatsMap.values());

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

  const matchupMap = new Map<string, (typeof allGames)[number][]>();
  for (const game of allGames) {
    const key = `${game.team.leagueId}:${game.week}:${game.sleeperMatchupId}`;
    if (!matchupMap.has(key)) matchupMap.set(key, []);
    matchupMap.get(key)!.push(game);
  }

  interface GameResult {
    teamId: string;
    userName: string;
    year: number;
    week: number;
    pointsScored: number;
    leagueName: string;
    result: 'W' | 'L' | 'T';
  }

  const gameResults: GameResult[] = [];
  for (const [, games] of matchupMap) {
    if (games.length !== 2) continue;
    const [g1, g2] = games;

    const r1: 'W' | 'L' | 'T' =
      g1.pointsScored > g2.pointsScored
        ? 'W'
        : g1.pointsScored < g2.pointsScored
        ? 'L'
        : 'T';
    const r2: 'W' | 'L' | 'T' = r1 === 'W' ? 'L' : r1 === 'L' ? 'W' : 'T';

    gameResults.push({
      teamId: g1.teamId,
      userName: g1.team.user?.discordName || 'Unknown',
      year: g1.team.league.year,
      week: g1.week,
      pointsScored: g1.pointsScored,
      leagueName: g1.team.league.name,
      result: r1,
    });

    gameResults.push({
      teamId: g2.teamId,
      userName: g2.team.user?.discordName || 'Unknown',
      year: g2.team.league.year,
      week: g2.week,
      pointsScored: g2.pointsScored,
      leagueName: g2.team.league.name,
      result: r2,
    });
  }

  const teamGameMap = new Map<string, GameResult[]>();
  for (const result of gameResults) {
    if (!teamGameMap.has(result.teamId)) teamGameMap.set(result.teamId, []);
    teamGameMap.get(result.teamId)!.push(result);
  }

  for (const [, games] of teamGameMap) {
    games.sort((a, b) => a.week - b.week);
  }

  interface StreakInfo {
    userName: string;
    year: number;
    leagueName: string;
    length: number;
    startWeek: number;
    endWeek: number;
  }

  function computeStreak(
    games: GameResult[],
    predicate: (g: GameResult) => boolean,
  ): StreakInfo | null {
    let maxLen = 0;
    let currentLen = 0;
    let maxStart = 0;
    let maxEnd = 0;
    let currentStart = 0;

    for (let i = 0; i < games.length; i++) {
      if (predicate(games[i])) {
        if (currentLen === 0) currentStart = i;
        currentLen++;
        if (currentLen > maxLen) {
          maxLen = currentLen;
          maxStart = currentStart;
          maxEnd = i;
        }
      } else {
        currentLen = 0;
      }
    }

    if (maxLen === 0) return null;
    return {
      userName: games[0].userName,
      year: games[0].year,
      leagueName: games[0].leagueName,
      length: maxLen,
      startWeek: games[maxStart].week,
      endWeek: games[maxEnd].week,
    };
  }

  const winStreaks: StreakInfo[] = [];
  const lossStreaks: StreakInfo[] = [];
  const streak100: StreakInfo[] = [];

  for (const [, games] of teamGameMap) {
    const ws = computeStreak(games, g => g.result === 'W');
    if (ws) winStreaks.push(ws);

    const ls = computeStreak(games, g => g.result === 'L');
    if (ls) lossStreaks.push(ls);

    const s100 = computeStreak(games, g => g.pointsScored >= 100);
    if (s100) streak100.push(s100);
  }

  winStreaks.sort((a, b) => b.length - a.length);
  lossStreaks.sort((a, b) => b.length - a.length);
  streak100.sort((a, b) => b.length - a.length);

  const makeStreakRows = (streaks: StreakInfo[]): RecordRow[] =>
    streaks.slice(0, TOP_N).map(s => ({
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
