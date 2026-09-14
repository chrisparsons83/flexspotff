import { prisma } from '~/db.server';
import {
  getDraftPicks,
  getLeagueDrafts,
  getLeagueInfo,
  getLeagueMatchups,
} from '~/libs/sleeper/api.server';
import { bestBallLineup } from '~/libs/sleeper/best-ball';
import {
  getOwnerToUserIdMap,
  resolveLeagueOwners,
} from '~/libs/sleeper/owners.server';
import { getNflState } from '~/libs/syncs.server';
import { upsertD12DraftPicksForLeague } from '~/models/d12draftpick.server';
import type { D12League } from '~/models/d12league.server';
import { getD12LeaguesBySeasonId } from '~/models/d12league.server';
import { getD12SeasonByYear } from '~/models/d12season.server';
import { getPlayersBySleepersIds } from '~/models/players.server';

/** D12 mirrors the NFL regular season, which the leaderboard caps at week 17. */
export const LAST_D12_WEEK = 17;

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

/** How a league's weeks are scored, which best ball changes. */
export type D12LeagueLineup = {
  bestBall: boolean;
  /**
   * Sleeper calls the league best ball but gave us no roster shape to optimise
   * into, so `bestBall` is off and weeks fall back to the frozen-starters total
   * this module exists to replace. Reported rather than stored quietly.
   */
  bestBallUnscorable: boolean;
  /** `roster_positions`, so we know which slots a best-ball lineup has to fill. */
  rosterPositions: string[];
  /**
   * Sleeper player ID -> position, or null for an ID we looked up and have no
   * position for. Cached here so syncing several weeks of one league costs one
   * player lookup rather than one per week.
   */
  positionBySleeperId: Map<string, string | null>;
};

/**
 * Reads the scoring shape of a D12 league off Sleeper.
 *
 * Callers syncing several weeks of one league should fetch this once and pass it
 * in - it never changes mid-season.
 */
export async function getD12LeagueLineup(
  sleeperLeagueId: string,
): Promise<D12LeagueLineup> {
  const info = await getLeagueInfo(sleeperLeagueId);
  const rosterPositions = info.roster_positions ?? [];
  const declaredBestBall = info.settings?.best_ball === 1;

  return {
    // Best ball needs a roster shape to optimise into. Without one we can only
    // fall back to what Sleeper reports, which is the pre-fix behaviour.
    bestBall: declaredBestBall && rosterPositions.length > 0,
    bestBallUnscorable: declaredBestBall && rosterPositions.length === 0,
    rosterPositions,
    positionBySleeperId: new Map(),
  };
}

export async function syncD12LeagueWeek(
  league: D12League,
  week: number,
  rosterToOwner: Map<number, string>,
  ownerToUserId: Map<string, string>,
  lineup?: D12LeagueLineup,
): Promise<string[]> {
  const [matchups, resolvedLineup] = await Promise.all([
    getLeagueMatchups(league.sleeperLeagueId, week),
    lineup
      ? Promise.resolve(lineup)
      : getD12LeagueLineup(league.sleeperLeagueId),
  ]);

  // Positions for every player on every roster in the league, in one query. Only
  // best ball needs them, since it picks the lineup rather than reading it. The
  // map is cached on the lineup, so a multi-week sync only looks up IDs it has
  // not seen on an earlier week.
  const { positionBySleeperId } = resolvedLineup;
  if (resolvedLineup.bestBall) {
    const newSleeperIds = Array.from(
      new Set(
        matchups.flatMap(matchup => Object.keys(matchup.players_points ?? {})),
      ),
    ).filter(sleeperId => !positionBySleeperId.has(sleeperId));
    if (newSleeperIds.length > 0) {
      // Seeded null so an ID with no player row counts as looked up, rather than
      // being re-queried on every remaining week of the season.
      for (const sleeperId of newSleeperIds) {
        positionBySleeperId.set(sleeperId, null);
      }
      for (const player of await getPlayersBySleepersIds(newSleeperIds)) {
        positionBySleeperId.set(player.sleeperId, player.position);
      }
    }
  }

  const upserts = [];
  const unplaceable = new Set<string>();
  const unknownSlots = new Set<string>();
  let rostersMissingPlayerPoints = 0;
  for (const matchup of matchups) {
    const ownerId = rosterToOwner.get(matchup.roster_id);
    if (!ownerId) continue;
    const userId = ownerToUserId.get(ownerId);
    if (!userId) continue;

    // Sleeper's `points` is the frozen starters' total, not the best-ball
    // optimum its own UI shows, so a best-ball league is scored here instead -
    // but only when Sleeper actually returned the whole roster's points.
    // Optimising an absent `players_points` would score the roster 0 and
    // overwrite a good stored score with it, so that case falls back too.
    const playersPoints = matchup.players_points ?? {};
    const hasPlayersPoints = Object.keys(playersPoints).length > 0;
    let score: {
      points: number | null;
      starters: string[];
      startingPlayerPoints: number[];
    };
    if (resolvedLineup.bestBall && hasPlayersPoints) {
      const optimal = bestBallLineup({
        rosterPositions: resolvedLineup.rosterPositions,
        playersPoints,
        positionBySleeperId,
      });
      for (const sleeperId of optimal.unplaceable) unplaceable.add(sleeperId);
      for (const slot of optimal.unknownSlots) unknownSlots.add(slot);
      score = {
        points: optimal.points,
        starters: optimal.starters,
        startingPlayerPoints: optimal.startingPlayerPoints,
      };
    } else {
      if (resolvedLineup.bestBall) rostersMissingPlayerPoints++;
      score = {
        points: matchup.points,
        starters: (matchup.starters ?? []).map(starter => starter ?? '0'),
        startingPlayerPoints: (matchup.starters_points ?? []).map(
          points => points ?? 0,
        ),
      };
    }

    upserts.push(
      prisma.d12WeekScore.upsert({
        where: {
          d12LeagueId_userId_week: {
            d12LeagueId: league.id,
            userId,
            week,
          },
        },
        update: score,
        create: {
          d12LeagueId: league.id,
          userId,
          week,
          ...score,
        },
      }),
    );
  }

  await prisma.$transaction(upserts);

  // Everything below is points the best-ball lineup could not account for.
  // Reported through the same channel as a failed league rather than silently
  // storing an undercount.
  const errors: string[] = [];
  const where = `"${league.name}" week ${week}`;

  if (resolvedLineup.bestBallUnscorable) {
    errors.push(
      `${where}: Sleeper reports this league as best ball but returned no roster_positions, so the week was stored as Sleeper's frozen-starters total, which understates a best-ball score.`,
    );
  }
  if (rostersMissingPlayerPoints > 0) {
    errors.push(
      `${where}: Sleeper returned no players_points for ${rostersMissingPlayerPoints} roster(s), so their frozen-starters total was stored instead of the best-ball optimum.`,
    );
  }
  if (unknownSlots.size > 0) {
    errors.push(
      `${where}: unrecognised roster slot(s) ${Array.from(unknownSlots).join(
        ', ',
      )} were left empty, so whatever would have filled them is missing from the best-ball total.`,
    );
  }
  if (unplaceable.size > 0) {
    errors.push(
      `${where}: no position on record for Sleeper player(s) ${Array.from(
        unplaceable,
      ).join(
        ', ',
      )}, so their points were left out of the best-ball lineup. Run the NFL player sync.`,
    );
  }

  return errors;
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
  // The leaderboard stops at week 17 and syncD12Season only ever backfills that
  // far, so a week-18 row written here would be summed into season totals by a
  // read query with no week filter and then never refreshed.
  if (week > LAST_D12_WEEK) return [];

  const leagues = await getD12LeaguesForYear(year);
  // Built once for every league below - it reads the whole member table.
  const owners = await getOwnerToUserIdMap();
  const errors: string[] = [];

  await Promise.all(
    leagues.map(async league => {
      try {
        const [{ rosterToOwner, ownerToUserId }, lineup] = await Promise.all([
          resolveLeagueOwners(league.sleeperLeagueId, owners),
          getD12LeagueLineup(league.sleeperLeagueId),
        ]);
        errors.push(
          ...(await syncD12LeagueWeek(
            league,
            week,
            rosterToOwner,
            ownerToUserId,
            lineup,
          )),
        );
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
        // Both are per-league rather than per-week, so they stay out of the loop.
        const [{ rosterToOwner, ownerToUserId }, lineup] = await Promise.all([
          resolveLeagueOwners(league.sleeperLeagueId, owners),
          getD12LeagueLineup(league.sleeperLeagueId),
        ]);
        for (let week = 1; week <= currentWeek; week++) {
          errors.push(
            ...(await syncD12LeagueWeek(
              league,
              week,
              rosterToOwner,
              ownerToUserId,
              lineup,
            )),
          );
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
