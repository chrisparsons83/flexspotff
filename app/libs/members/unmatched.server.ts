import { getLeaguesByYear } from '~/models/league.server';
import { getSleeperUsersByOwnerIds } from '~/models/sleeperUser.server';

/**
 * This season's leagues, each with the teams whose Sleeper owner is not
 * matched to a member yet.
 *
 * The mapping table is the source of truth for what "matched" means. A team
 * can carry a stale userId from an older sync, so checking Team.userId alone
 * would hide owners whose mapping has since been deleted.
 */
export async function getUnmatchedTeams(year: number) {
  const leagues = await getLeaguesByYear(year);
  const existingMatches = await getSleeperUsersByOwnerIds(
    leagues.flatMap(league => league.teams.map(team => team.sleeperOwnerId)),
  );
  const matchedOwnerIds = new Set(
    existingMatches.map(({ sleeperOwnerID }) => sleeperOwnerID),
  );
  return leagues.map(league => ({
    league,
    unmatchedTeams: league.teams.filter(
      team => !matchedOwnerIds.has(team.sleeperOwnerId),
    ),
  }));
}
