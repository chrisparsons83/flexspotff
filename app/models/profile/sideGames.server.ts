import { prisma } from '~/db.server';

/**
 * Each side game's slice of a member's profile.
 *
 * They share a shape on purpose - seasons played, a headline number, a per
 * season table, and a couple of highlights - so the tabs read alike even though
 * the games score nothing like each other. `hasPlayed: false` renders an empty
 * state rather than hiding the tab, which keeps the tab bar stable between
 * members.
 */

export type SeasonTotal = {
  year: number;
  label: string;
  value: string;
  detail?: string;
};

export type ContestProfile = {
  hasPlayed: boolean;
  seasonsPlayed: number;
  headline: { label: string; value: string }[];
  seasons: SeasonTotal[];
};

const empty: ContestProfile = {
  hasPlayed: false,
  seasonsPlayed: 0,
  headline: [],
  seasons: [],
};

const round = (value: number, digits = 2) => value.toFixed(digits);

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Cup: bracket runs, seeds, titles. Rounds are named, and ROUND_OF_2 is the final. */
export async function getCupProfile(userId: string): Promise<ContestProfile> {
  const cupTeams = await prisma.cupTeam.findMany({
    where: { team: { userId } },
    include: {
      cup: { select: { year: true } },
      TopTeamGames: { select: { id: true, round: true, winningTeamId: true } },
      BottomTeamGames: {
        select: { id: true, round: true, winningTeamId: true },
      },
    },
  });

  if (cupTeams.length === 0) return empty;

  let championships = 0;
  let finals = 0;
  let wins = 0;
  let played = 0;

  const seasons: SeasonTotal[] = cupTeams
    .map(cupTeam => {
      const games = [...cupTeam.TopTeamGames, ...cupTeam.BottomTeamGames];
      const decided = games.filter(game => game.winningTeamId !== null);
      const seasonWins = decided.filter(
        game => game.winningTeamId === cupTeam.id,
      ).length;
      const reachedFinal = decided.some(game => game.round === 'ROUND_OF_2');
      const wonFinal = decided.some(
        game =>
          game.round === 'ROUND_OF_2' && game.winningTeamId === cupTeam.id,
      );

      played += decided.length;
      wins += seasonWins;
      if (reachedFinal) finals++;
      if (wonFinal) championships++;

      return {
        year: cupTeam.cup.year,
        label: `Seed ${cupTeam.seed}`,
        value: `${seasonWins}-${decided.length - seasonWins}`,
        detail: wonFinal ? 'Champion' : reachedFinal ? 'Finalist' : undefined,
      };
    })
    .sort((a, b) => b.year - a.year);

  return {
    hasPlayed: true,
    seasonsPlayed: cupTeams.length,
    headline: [
      { label: 'Championships', value: championships.toString() },
      { label: 'Finals', value: finals.toString() },
      { label: 'Game Record', value: `${wins}-${played - wins}` },
    ],
    seasons,
  };
}

/** D12: weekly points across a separate set of leagues. */
export async function getD12Profile(userId: string): Promise<ContestProfile> {
  const scores = await prisma.d12WeekScore.findMany({
    where: { userId },
    include: { league: { include: { season: { select: { year: true } } } } },
  });

  if (scores.length === 0) return empty;

  const byYear = new Map<number, number[]>();
  for (const score of scores) {
    if (score.points === null) continue;
    const year = score.league.season.year;
    const existing = byYear.get(year);
    if (existing) {
      existing.push(score.points);
    } else {
      byYear.set(year, [score.points]);
    }
  }

  const allPoints = Array.from(byYear.values()).flat();
  const best = allPoints.length > 0 ? Math.max(...allPoints) : 0;
  const total = allPoints.reduce((sum, points) => sum + points, 0);

  return {
    hasPlayed: true,
    seasonsPlayed: byYear.size,
    headline: [
      { label: 'Total Points', value: round(total) },
      { label: 'Best Week', value: round(best) },
      { label: 'Weeks Played', value: allPoints.length.toString() },
    ],
    seasons: Array.from(byYear.entries())
      .map(([year, points]) => ({
        year,
        label: plural(points.length, 'week'),
        value: round(points.reduce((sum, p) => sum + p, 0)),
        detail: `Best ${round(Math.max(...points))}`,
      }))
      .sort((a, b) => b.year - a.year),
  };
}

/** QB Streaming: a standard and a deep pick each week. */
export async function getQbStreamingProfile(
  userId: string,
): Promise<ContestProfile> {
  const selections = await prisma.qBSelection.findMany({
    where: { userId },
    include: {
      qbStreamingWeek: { select: { year: true, week: true } },
      standardPlayer: { select: { pointsScored: true } },
      deepPlayer: { select: { pointsScored: true } },
    },
  });

  if (selections.length === 0) return empty;

  const byYear = new Map<number, number>();
  let total = 0;
  let bestWeek = 0;

  for (const selection of selections) {
    const points =
      selection.standardPlayer.pointsScored + selection.deepPlayer.pointsScored;
    total += points;
    bestWeek = Math.max(bestWeek, points);
    const year = selection.qbStreamingWeek.year;
    byYear.set(year, (byYear.get(year) ?? 0) + points);
  }

  return {
    hasPlayed: true,
    seasonsPlayed: byYear.size,
    headline: [
      { label: 'Total Points', value: round(total) },
      { label: 'Best Week', value: round(bestWeek) },
      { label: 'Weeks Entered', value: selections.length.toString() },
    ],
    seasons: Array.from(byYear.entries())
      .map(([year, points]) => ({
        year,
        label: 'Points',
        value: round(points),
      }))
      .sort((a, b) => b.year - a.year),
  };
}

/**
 * Spread Pool: the only contest with a bankroll. Missed weeks carry their own
 * penalty row, so they are added in separately.
 */
export async function getSpreadPoolProfile(
  userId: string,
): Promise<ContestProfile> {
  const [picks, missed] = await Promise.all([
    prisma.poolGamePick.findMany({
      where: { userId, isScored: true },
      include: { poolGame: { include: { poolWeek: true } } },
    }),
    prisma.poolWeekMissed.findMany({
      where: { userId },
      include: { poolWeek: true },
    }),
  ]);

  if (picks.length === 0 && missed.length === 0) return empty;

  const byYear = new Map<
    number,
    { net: number; w: number; l: number; t: number }
  >();
  const bump = (year: number) => {
    const existing = byYear.get(year) ?? { net: 0, w: 0, l: 0, t: 0 };
    byYear.set(year, existing);
    return existing;
  };

  let net = 0;
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let biggestBet = 0;

  for (const pick of picks) {
    const year = pick.poolGame.poolWeek?.year;
    if (year === undefined) continue;
    const entry = bump(year);
    const result = pick.resultWonLoss ?? 0;

    entry.net += result;
    entry.w += pick.isWin;
    entry.l += pick.isLoss;
    entry.t += pick.isTie;

    net += result;
    wins += pick.isWin;
    losses += pick.isLoss;
    ties += pick.isTie;
    biggestBet = Math.max(biggestBet, pick.amountBet);
  }

  for (const week of missed) {
    const year = week.poolWeek?.year;
    if (year === undefined) continue;
    const entry = bump(year);
    entry.net += week.resultWonLoss ?? 0;
    net += week.resultWonLoss ?? 0;
  }

  return {
    hasPlayed: true,
    seasonsPlayed: byYear.size,
    headline: [
      { label: 'Net', value: net > 0 ? `+${net}` : net.toString() },
      { label: 'Record', value: `${wins}-${losses}-${ties}` },
      { label: 'Biggest Bet', value: biggestBet.toString() },
      { label: 'Weeks Missed', value: missed.length.toString() },
    ],
    seasons: Array.from(byYear.entries())
      .map(([year, entry]) => ({
        year,
        label: `${entry.w}-${entry.l}-${entry.t}`,
        value: entry.net > 0 ? `+${entry.net}` : entry.net.toString(),
      }))
      .sort((a, b) => b.year - a.year),
  };
}

/** Locks Challenge: straight win/loss picks, no wagering. */
export async function getLocksProfile(userId: string): Promise<ContestProfile> {
  const picks = await prisma.locksGamePick.findMany({
    where: { userId, isScored: true },
    include: { locksGame: { include: { locksWeek: true } } },
  });

  if (picks.length === 0) return empty;

  const byYear = new Map<number, { w: number; l: number; t: number }>();
  let wins = 0;
  let losses = 0;
  let ties = 0;

  for (const pick of picks) {
    const year = pick.locksGame.locksWeek?.year;
    if (year === undefined) continue;

    const entry = byYear.get(year) ?? { w: 0, l: 0, t: 0 };
    entry.w += pick.isWin;
    entry.l += pick.isLoss;
    entry.t += pick.isTie;
    byYear.set(year, entry);

    wins += pick.isWin;
    losses += pick.isLoss;
    ties += pick.isTie;
  }

  const decided = wins + losses;

  return {
    hasPlayed: true,
    seasonsPlayed: byYear.size,
    headline: [
      { label: 'Record', value: `${wins}-${losses}-${ties}` },
      {
        label: 'Win %',
        value: decided > 0 ? `${((wins / decided) * 100).toFixed(1)}%` : '0%',
      },
      { label: 'Picks', value: picks.length.toString() },
    ],
    seasons: Array.from(byYear.entries())
      .map(([year, entry]) => ({
        year,
        label: 'Record',
        value: `${entry.w}-${entry.l}-${entry.t}`,
      }))
      .sort((a, b) => b.year - a.year),
  };
}

/** DFS Survivor: a scored lineup each week, totalled over a season. */
export async function getDfsSurvivorProfile(
  userId: string,
): Promise<ContestProfile> {
  const years = await prisma.dFSSurvivorUserYear.findMany({
    where: { userId },
    include: {
      weeks: { include: { entries: { select: { points: true } } } },
    },
  });

  if (years.length === 0) return empty;

  let bestWeek = 0;
  let totalPoints = 0;

  const seasons: SeasonTotal[] = years
    .map(year => {
      const weekTotals = year.weeks.map(week =>
        week.entries.reduce((sum, entry) => sum + entry.points, 0),
      );
      const seasonBest = weekTotals.length > 0 ? Math.max(...weekTotals) : 0;

      bestWeek = Math.max(bestWeek, seasonBest);
      totalPoints += year.points;

      return {
        year: year.year,
        label: plural(year.weeks.length, 'week'),
        value: round(year.points),
        detail: seasonBest > 0 ? `Best ${round(seasonBest)}` : undefined,
      };
    })
    .sort((a, b) => b.year - a.year);

  return {
    hasPlayed: true,
    seasonsPlayed: years.length,
    headline: [
      { label: 'Total Points', value: round(totalPoints) },
      { label: 'Best Week', value: round(bestWeek) },
    ],
    seasons,
  };
}

/** F-Squared: pick teams from the redraft leagues and ride their results. */
export async function getFSquaredProfile(
  userId: string,
): Promise<ContestProfile> {
  const entries = await prisma.fSquaredEntry.findMany({
    where: { userId },
    include: {
      teams: {
        select: {
          wins: true,
          losses: true,
          ties: true,
          league: { select: { name: true } },
        },
      },
    },
  });

  if (entries.length === 0) return empty;

  let wins = 0;
  let losses = 0;
  let ties = 0;

  const seasons: SeasonTotal[] = entries
    .map(entry => {
      const entryWins = entry.teams.reduce((sum, team) => sum + team.wins, 0);
      const entryLosses = entry.teams.reduce(
        (sum, team) => sum + team.losses,
        0,
      );
      const entryTies = entry.teams.reduce((sum, team) => sum + team.ties, 0);

      wins += entryWins;
      losses += entryLosses;
      ties += entryTies;

      return {
        year: entry.year,
        label: plural(entry.teams.length, 'team'),
        value: `${entryWins}-${entryLosses}-${entryTies}`,
      };
    })
    .sort((a, b) => b.year - a.year);

  return {
    hasPlayed: true,
    seasonsPlayed: entries.length,
    headline: [
      { label: 'Picked Teams Record', value: `${wins}-${losses}-${ties}` },
    ],
    seasons,
  };
}

/** Omni: a draft of athletes across many sports. */
export async function getOmniProfile(userId: string): Promise<ContestProfile> {
  const omniTeams = await prisma.omniUserTeam.findMany({
    where: { userId },
    include: {
      season: { select: { year: true } },
      draftPicks: {
        include: {
          player: {
            select: {
              pointsScored: true,
              sport: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (omniTeams.length === 0) return empty;

  let totalPoints = 0;
  let totalPicks = 0;

  const seasons: SeasonTotal[] = omniTeams
    .map(team => {
      const points = team.draftPicks.reduce(
        (sum, pick) => sum + (pick.player?.pointsScored ?? 0),
        0,
      );
      const sports = new Set(
        team.draftPicks
          .map(pick => pick.player?.sport.name)
          .filter((name): name is string => Boolean(name)),
      );

      totalPoints += points;
      totalPicks += team.draftPicks.length;

      return {
        year: team.season.year,
        label: plural(team.draftPicks.length, 'pick'),
        value: points.toString(),
        detail: `${sports.size} sports`,
      };
    })
    .sort((a, b) => b.year - a.year);

  return {
    hasPlayed: true,
    seasonsPlayed: omniTeams.length,
    headline: [
      { label: 'Points', value: totalPoints.toString() },
      { label: 'Athletes Drafted', value: totalPicks.toString() },
    ],
    seasons,
  };
}
