import { getLeagueRosterOwners } from './api.server';
import { getUsersIncludingMerged } from '~/models/user.server';

/**
 * Maps every known Sleeper owner ID to the member it belongs to.
 *
 * Merged members are included and resolved to whoever absorbed them. Leaving
 * them out instead would make a Sleeper link that still points at one fail to
 * resolve, and the row would be saved with a null user - which drops those
 * seasons out of the record book, since getCareerRecords skips them.
 */
export async function getOwnerToUserIdMap(): Promise<Map<string, string>> {
  const users = await getUsersIncludingMerged();

  const ownerToUserId = new Map<string, string>();
  for (const { id, mergedInto, sleeperUsers } of users) {
    for (const sleeperUser of sleeperUsers) {
      ownerToUserId.set(sleeperUser.sleeperOwnerID, mergedInto?.id ?? id);
    }
  }

  return ownerToUserId;
}

export type LeagueOwners = {
  /** Sleeper roster ID -> Sleeper owner ID, for this league. */
  rosterToOwner: Map<number, string>;
  /** Sleeper owner ID -> our user ID, across all members. */
  ownerToUserId: Map<string, string>;
};

/**
 * Everything a per-league sync needs to turn a Sleeper roster into one of our
 * members. Rosters with no owner, or an owner we've never linked, are simply
 * absent from the maps and should be skipped by the caller.
 *
 * @param ownerToUserId - a map from getOwnerToUserIdMap(). Callers syncing more
 * than one league should build it once and pass it in: it reads every member
 * row, and leaving it to each league means that whole query runs once per
 * league, concurrently.
 */
export async function resolveLeagueOwners(
  sleeperLeagueId: string,
  ownerToUserId?: Map<string, string>,
): Promise<LeagueOwners> {
  const [rosters, resolvedOwnerToUserId] = await Promise.all([
    getLeagueRosterOwners(sleeperLeagueId),
    ownerToUserId ? Promise.resolve(ownerToUserId) : getOwnerToUserIdMap(),
  ]);

  const rosterToOwner = new Map<number, string>();
  for (const roster of rosters) {
    if (roster.owner_id) {
      rosterToOwner.set(roster.roster_id, roster.owner_id);
    }
  }

  return { rosterToOwner, ownerToUserId: resolvedOwnerToUserId };
}
