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
