import { prisma } from '~/db.server';
import {
  getDraftPicks,
  getLeagueDrafts,
  getLeagueInfo,
  getLeagueMatchups,
} from '~/libs/sleeper/api.server';
import {
  getOwnerToUserIdMap,
  resolveLeagueOwners,
} from '~/libs/sleeper/owners.server';
import { getNflState } from '~/libs/syncs.server';
import { upsertD12DraftPicksForLeague } from '~/models/d12draftpick.server';
import type { D12League } from '~/models/d12league.server';
import { getD12LeaguesBySeasonId } from '~/models/d12league.server';
import { getD12SeasonByYear } from '~/models/d12season.server';

/** D12 mirrors the NFL regular season, which the leaderboard caps at week 17. */
const LAST_D12_WEEK = 17;

export { resolveLeagueOwners };

export async function getSleeperLeagueInfo(sleeperLeagueId: string) {
  return getLeagueInfo(sleeperLeagueId);
}

export function parseSleeperLeagueIdFromUrl(input: string): string {
  // Accept a raw numeric ID or a full sleeper.com URL such as:
  // https://sleeper.com/leagues/123456789/...
  // https://sleeper.app/leagues/123456789/...
  const match = input.match(/\/leagues\/(\d+)/);
  if (match) return match[1];
  // Fall back: if the input is already a plain numeric ID
  if (/^\d+$/.test(input.trim())) return input.trim();
  throw new Error(
    `Could not parse a Sleeper league ID from: "${input}". Paste the full league URL from sleeper.com.`,
  );
}

/**
 * How many of a league's rosters we can already attribute to a member. Shown
 * when an admin adds a league, as a warning that Sleeper accounts still need
 * matching up.
 */
export async function inferD12LeagueUsers(sleeperLeagueId: string) {
  const { rosterToOwner, ownerToUserId } = await resolveLeagueOwners(
    sleeperLeagueId,
  );

  return Array.from(rosterToOwner.values())
    .map(sleeperOwnerID => ({
      sleeperOwnerID,
      userId: ownerToUserId.get(sleeperOwnerID),
    }))
    .filter((entry): entry is { sleeperOwnerID: string; userId: string } =>
      Boolean(entry.userId),
    );
}

export async function syncD12LeagueWeek(
  league: D12League,
  week: number,
  rosterToOwner: Map<number, string>,
  ownerToUserId: Map<string, string>,
) {
  const matchups = await getLeagueMatchups(league.sleeperLeagueId, week);

  const upserts = [];
  for (const matchup of matchups) {
    const ownerId = rosterToOwner.get(matchup.roster_id);
    if (!ownerId) continue;
    const userId = ownerToUserId.get(ownerId);
    if (!userId) continue;

    upserts.push(
      prisma.d12WeekScore.upsert({
        where: {
          d12LeagueId_userId_week: {
            d12LeagueId: league.id,
            userId,
            week,
          },
        },
        update: { points: matchup.points },
        create: {
          d12LeagueId: league.id,
          userId,
          week,
          points: matchup.points,
        },
      }),
    );
  }

  await prisma.$transaction(upserts);
}

async function fetchDraftPicks(sleeperLeagueId: string) {
  const drafts = await getLeagueDrafts(sleeperLeagueId);
  const completeDrafts = drafts.filter(d => d.status === 'complete');
  if (completeDrafts.length === 0) return [];
  return getDraftPicks(completeDrafts[0].draft_id);
}

export async function getSleeperDraftPicksForLeague(
  sleeperLeagueId: string,
): Promise<Array<{ player_id: string; pick_no: number; roster_id: number }>> {
  return fetchDraftPicks(sleeperLeagueId);
}

export async function getSleeperDraftPicksByUser(
  sleeperLeagueId: string,
  sleeperOwnerID: string,
): Promise<Array<{ player_id: string; pick_no: number }>> {
  const { rosterToOwner } = await resolveLeagueOwners(sleeperLeagueId);
  const userEntry = Array.from(rosterToOwner.entries()).find(
    ([, ownerId]) => ownerId === sleeperOwnerID,
  );
  if (!userEntry) return [];
  const [userRosterId] = userEntry;
  const allPicks = await fetchDraftPicks(sleeperLeagueId);
  return allPicks.filter(p => p.roster_id === userRosterId);
}

async function getD12LeaguesForYear(year: number) {
  const season = await getD12SeasonByYear(year);
  if (!season) throw new Error(`No D12 season found for year ${year}`);
  return getD12LeaguesBySeasonId(season.id);
}

/**
 * Syncs one week across every D12 league.
 *
 * This is what the five-minute score monitor calls. Syncing the whole season on
 * that cadence would be roughly a hundred Sleeper requests every five minutes,
 * for weeks whose scores were final months ago.
 *
 * @returns one message per league that failed; an empty array means every
 * league synced.
 */
export async function syncD12Week(
  year: number,
  week: number,
): Promise<string[]> {
  const leagues = await getD12LeaguesForYear(year);
  // Built once for every league below - it reads the whole member table.
  const owners = await getOwnerToUserIdMap();
  const errors: string[] = [];

  await Promise.all(
    leagues.map(async league => {
      try {
        const { rosterToOwner, ownerToUserId } = await resolveLeagueOwners(
          league.sleeperLeagueId,
          owners,
        );
        await syncD12LeagueWeek(league, week, rosterToOwner, ownerToUserId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`"${league.name}" week ${week}: ${msg}`);
      }
    }),
  );

  return errors;
}

/**
 * Full-season backfill, for weeks the live monitor missed and for Sleeper's
 * after-the-fact stat corrections.
 */
export async function syncD12Season(year: number): Promise<string[]> {
  const leagues = await getD12LeaguesForYear(year);
  const currentWeek = Math.min((await getNflState()).week, LAST_D12_WEEK);
  const owners = await getOwnerToUserIdMap();
  const errors: string[] = [];

  await Promise.all(
    leagues.map(async league => {
      try {
        const { rosterToOwner, ownerToUserId } = await resolveLeagueOwners(
          league.sleeperLeagueId,
          owners,
        );
        for (let week = 1; week <= currentWeek; week++) {
          await syncD12LeagueWeek(league, week, rosterToOwner, ownerToUserId);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`"${league.name}": ${msg}`);
      }
    }),
  );

  return errors;
}

export async function syncD12DraftPicksForSeason(
  year: number,
): Promise<string[]> {
  const leagues = await getD12LeaguesForYear(year);
  const owners = await getOwnerToUserIdMap();
  const errors: string[] = [];

  await Promise.all(
    leagues.map(async league => {
      try {
        const [picks, { rosterToOwner, ownerToUserId }] = await Promise.all([
          getSleeperDraftPicksForLeague(league.sleeperLeagueId),
          resolveLeagueOwners(league.sleeperLeagueId, owners),
        ]);
        if (picks.length === 0) return;
        const enriched = picks.map(pick => {
          const ownerId = rosterToOwner.get(pick.roster_id);
          const userId = ownerId ? ownerToUserId.get(ownerId) ?? null : null;
          return { sleeperId: pick.player_id, pickNo: pick.pick_no, userId };
        });
        await upsertD12DraftPicksForLeague(league.id, enriched);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`"${league.name}": ${msg}`);
      }
    }),
  );

  return errors;
}
