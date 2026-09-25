import { sleeperFetch } from './client.server';
import {
  sleeperAdpJson,
  sleeperDraftJson,
  sleeperDraftListJson,
  sleeperDraftPicksJson,
  sleeperGraphqlNflGames,
  sleeperHistoricalStatsJson,
  sleeperLeagueInfoJson,
  sleeperLeagueUsersJson,
  sleeperMatchupJson,
  sleeperNflPlayersJson,
  sleeperNflStateJson,
  sleeperProjectionsJson,
  sleeperRosterOwnersJson,
  sleeperRostershipJson,
  sleeperStatsJson,
  sleeperTeamJson,
  sleeperTransactionsJson,
  type SleeperGraphqlNflGames,
} from './schemas';
import { graphQLClient } from '~/services/sleeperGraphql.server';

/**
 * Typed wrappers around the Sleeper endpoints we use. Sync libraries and admin
 * routes should call these rather than building URLs themselves.
 */

export const getNflState = () =>
  sleeperFetch('/v1/state/nfl', sleeperNflStateJson);

export const getNflPlayers = () =>
  sleeperFetch('/v1/players/nfl', sleeperNflPlayersJson);

export const getLeagueInfo = (sleeperLeagueId: string) =>
  sleeperFetch(`/v1/league/${sleeperLeagueId}`, sleeperLeagueInfoJson);

/** Full roster rows, including win/loss settings and metadata. */
export const getLeagueRosters = (sleeperLeagueId: string) =>
  sleeperFetch(`/v1/league/${sleeperLeagueId}/rosters`, sleeperTeamJson);

/** The same endpoint, narrowed to the roster -> owner mapping. */
export const getLeagueRosterOwners = (sleeperLeagueId: string) =>
  sleeperFetch(
    `/v1/league/${sleeperLeagueId}/rosters`,
    sleeperRosterOwnersJson,
  );

export const getLeagueUsers = (sleeperLeagueId: string) =>
  sleeperFetch(`/v1/league/${sleeperLeagueId}/users`, sleeperLeagueUsersJson);

export const getLeagueMatchups = (sleeperLeagueId: string, week: number) =>
  sleeperFetch(
    `/v1/league/${sleeperLeagueId}/matchups/${week}`,
    sleeperMatchupJson,
  );

/**
 * Every transaction Sleeper filed under `week` - waivers, free agent adds and
 * trades together. Note that Sleeper files a Wednesday waiver batch under the
 * *outgoing* leg, so callers after a specific batch should fetch more than one
 * week and select by `status_updated`. See waiver-sync.server.ts.
 */
export const getLeagueTransactions = (sleeperLeagueId: string, week: number) =>
  sleeperFetch(
    `/v1/league/${sleeperLeagueId}/transactions/${week}`,
    sleeperTransactionsJson,
  );

export const getLeagueDrafts = (sleeperLeagueId: string) =>
  sleeperFetch(`/v1/league/${sleeperLeagueId}/drafts`, sleeperDraftListJson);

export const getDraft = (sleeperDraftId: string) =>
  sleeperFetch(`/v1/draft/${sleeperDraftId}`, sleeperDraftJson);

export const getDraftPicks = (sleeperDraftId: string) =>
  sleeperFetch(`/v1/draft/${sleeperDraftId}/picks`, sleeperDraftPicksJson);

/** Draft picks with the `picked_by` owner ID, which the ADP sync keys on. */
export const getDraftPicksWithOwners = (sleeperDraftId: string) =>
  sleeperFetch(`/v1/draft/${sleeperDraftId}/picks`, sleeperAdpJson);

export const getWeeklyStats = (
  year: number,
  week: number,
  positions: string[] = [],
) => {
  const query = positions.map(p => `position[]=${p}`).join('&');
  return sleeperFetch(
    `/v1/stats/nfl/regular/${year}/${week}${query ? `?${query}` : ''}`,
    sleeperStatsJson,
  );
};

/**
 * A week's stat lines with the player's team and game attached, for seasons
 * the site did not run live. Both positions QB streaming picks were ever made
 * from are asked for - Sleeper lists Taysom Hill as a TE.
 */
export const getHistoricalWeeklyStats = (year: number, week: number) =>
  sleeperFetch(
    `/stats/nfl/${year}/${week}?season_type=regular&position[]=QB&position[]=TE`,
    sleeperHistoricalStatsJson,
  );

/**
 * Rostership and projections live on api.sleeper.com rather than
 * api.sleeper.app, hence the base URL override.
 */
const SLEEPER_COM_BASE = 'https://api.sleeper.com';

export const getRostership = (year: number, week: number) =>
  sleeperFetch(
    `/players/nfl/research/regular/${year}/${week}`,
    sleeperRostershipJson,
    SLEEPER_COM_BASE,
  );

export const getProjections = (year: number, week: number) =>
  sleeperFetch(
    `/v1/projections/nfl/regular/${year}/${week}`,
    sleeperProjectionsJson,
    SLEEPER_COM_BASE,
  );

/**
 * NFL scores only exist behind Sleeper's GraphQL endpoint, so this one doesn't
 * go through `sleeperFetch`.
 */
export async function getNflScores(year: number, week: number) {
  const query = `query scores {
          scores(sport: "nfl",season_type: "regular",season: "${year}",week: ${week}){
            date
            game_id
            metadata
            season
            season_type
            sport
            status
            week
          }
        }`;
  const result = await graphQLClient.request<SleeperGraphqlNflGames>(query);
  return sleeperGraphqlNflGames.parse(result);
}
