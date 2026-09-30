import {
  buildFSquaredProfile,
  type FSquaredEntryRow,
  type FSquaredTeamRow,
} from './fSquaredProfile';
import { prisma } from '~/db.server';
import { getCurrentSeason } from '~/models/season.server';

const memberSelect = {
  id: true,
  discordName: true,
  discordUsername: true,
} as const;

/**
 * Everything the F² tab shows.
 *
 * A member turns up in F² two ways: by entering, and by managing a team other
 * entries picked. Both count, so someone who never entered still has a tab
 * saying who picked them.
 *
 * The whole field is loaded for those years, along with every team in them,
 * because every number on the tab is measured against it: a finish against
 * the other entries, and a pick against the rest of its league.
 */
export async function getFSquaredProfile(userId: string) {
  const played = await prisma.fSquaredEntry.groupBy({ by: ['year'] });
  const fSquaredYears = played.map(({ year }) => year);

  const [entered, managed] = await Promise.all([
    prisma.fSquaredEntry.findMany({
      where: { userId },
      select: { year: true },
    }),
    prisma.team.findMany({
      where: { userId, league: { year: { in: fSquaredYears } } },
      select: { league: { select: { year: true } } },
    }),
  ]);
  const years = Array.from(
    new Set([
      ...entered.map(row => row.year),
      ...managed.map(row => row.league.year),
    ]),
  );
  if (years.length === 0) return { hasPlayed: false as const };

  const [entries, teams, currentSeason] = await Promise.all([
    prisma.fSquaredEntry.findMany({
      where: { year: { in: years } },
      select: {
        year: true,
        user: { select: memberSelect },
        teams: { select: { id: true } },
      },
    }),
    prisma.team.findMany({
      where: { league: { year: { in: years } } },
      select: {
        id: true,
        pointsFor: true,
        user: { select: memberSelect },
        league: {
          select: {
            id: true,
            year: true,
            name: true,
            tier: true,
            draftDateTime: true,
          },
        },
      },
    }),
    getCurrentSeason(),
  ]);

  const entryRows: FSquaredEntryRow[] = entries.map(entry => ({
    year: entry.year,
    entrant: entry.user,
    teamIds: entry.teams.map(team => team.id),
  }));
  const teamRows: FSquaredTeamRow[] = teams.map(team => ({
    id: team.id,
    year: team.league.year,
    leagueId: team.league.id,
    leagueName: team.league.name,
    tier: team.league.tier,
    draftDateTime: team.league.draftDateTime,
    pointsFor: team.pointsFor,
    manager: team.user,
  }));

  const profile = buildFSquaredProfile({
    userId,
    teams: teamRows,
    entries: entryRows,
    inProgressYear: currentSeason?.year ?? null,
    now: new Date(),
  });

  // Every year they turn up in may be one whose leagues have not drafted.
  if (profile.seasons.length === 0 && profile.pickedBy.seasons.length === 0) {
    return { hasPlayed: false as const };
  }

  return { hasPlayed: true as const, ...profile };
}
