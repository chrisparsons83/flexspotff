import z from 'zod';
import { prisma } from '~/db.server';
import type { D12League } from '~/models/d12league.server';
import { getD12LeaguesBySeasonId } from '~/models/d12league.server';
import { getD12SeasonByYear } from '~/models/d12season.server';

const sleeperLeagueInfoSchema = z.object({
  name: z.string(),
});

export async function getSleeperLeagueInfo(sleeperLeagueId: string) {
  const res = await fetch(
    `https://api.sleeper.app/v1/league/${sleeperLeagueId}`,
  );
  if (!res.ok)
    throw new Error(
      `Sleeper API error ${res.status}: GET /league/${sleeperLeagueId}`,
    );
  return sleeperLeagueInfoSchema.parse(await res.json());
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

export async function getCurrentNFLWeek(): Promise<number> {
  const res = await fetch('https://api.sleeper.app/v1/state/nfl');
  if (!res.ok)
    throw new Error(`Sleeper API error ${res.status}: GET /state/nfl`);
  const nflState = z.object({ week: z.number() }).parse(await res.json());
  return Math.min(nflState.week, 17);
}

const sleeperMatchupSchema = z.array(
  z.object({
    roster_id: z.number(),
    points: z.number().nullable(),
    matchup_id: z.number().nullable(),
    starters: z.array(z.string().nullable()).nullable(),
    starters_points: z.array(z.number().nullable()).nullable(),
  }),
);

const sleeperRosterSchema = z.array(
  z.object({
    roster_id: z.number(),
    owner_id: z.string().nullable(),
  }),
);

async function getSleeperOwnerIdForLeague(
  sleeperLeagueId: string,
): Promise<Map<number, string>> {
  const res = await fetch(
    `https://api.sleeper.app/v1/league/${sleeperLeagueId}/rosters`,
  );
  if (!res.ok)
    throw new Error(
      `Sleeper API error ${res.status}: GET /league/${sleeperLeagueId}/rosters`,
    );
  const json = sleeperRosterSchema.parse(await res.json());
  const rosterToOwner = new Map<number, string>();
  for (const roster of json) {
    if (roster.owner_id) {
      rosterToOwner.set(roster.roster_id, roster.owner_id);
    }
  }
  return rosterToOwner;
}

export async function resolveLeagueOwners(sleeperLeagueId: string) {
  const rosterToOwner = await getSleeperOwnerIdForLeague(sleeperLeagueId);
  const ownerIds = Array.from(rosterToOwner.values());
  const sleeperUsers = await prisma.sleeperUser.findMany({
    where: { sleeperOwnerID: { in: ownerIds } },
    include: { user: true },
  });
  const ownerToUserId = new Map<string, string>();
  for (const su of sleeperUsers) {
    ownerToUserId.set(su.sleeperOwnerID, su.userId);
  }
  return { rosterToOwner, ownerToUserId, sleeperUsers };
}

export async function inferD12LeagueUsers(sleeperLeagueId: string) {
  const { sleeperUsers } = await resolveLeagueOwners(sleeperLeagueId);
  return sleeperUsers.map(su => ({
    sleeperOwnerID: su.sleeperOwnerID,
    userId: su.userId,
    discordName: su.user.discordName,
  }));
}

export async function syncD12LeagueWeek(
  league: D12League,
  week: number,
  rosterToOwner: Map<number, string>,
  ownerToUserId: Map<string, string>,
) {
  const res = await fetch(
    `https://api.sleeper.app/v1/league/${league.sleeperLeagueId}/matchups/${week}`,
  );
  if (!res.ok)
    throw new Error(
      `Sleeper API error ${res.status}: GET /league/${league.sleeperLeagueId}/matchups/${week}`,
    );
  const matchups = sleeperMatchupSchema.parse(await res.json());

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

const sleeperDraftListSchema = z.array(
  z.object({
    draft_id: z.string(),
    status: z.string(),
  }),
);

const sleeperDraftPickSchema = z.array(
  z.object({
    player_id: z.string(),
    pick_no: z.number(),
    roster_id: z.number(),
  }),
);

async function fetchDraftPicks(sleeperLeagueId: string) {
  const draftsRes = await fetch(
    `https://api.sleeper.app/v1/league/${sleeperLeagueId}/drafts`,
  );
  if (!draftsRes.ok)
    throw new Error(
      `Sleeper API error ${draftsRes.status}: GET /league/${sleeperLeagueId}/drafts`,
    );
  const drafts = sleeperDraftListSchema.parse(await draftsRes.json());
  const completeDrafts = drafts.filter(d => d.status === 'complete');
  if (completeDrafts.length === 0) return [];
  const draft = completeDrafts[0];
  const picksRes = await fetch(
    `https://api.sleeper.app/v1/draft/${draft.draft_id}/picks`,
  );
  if (!picksRes.ok)
    throw new Error(
      `Sleeper API error ${picksRes.status}: GET /draft/${draft.draft_id}/picks`,
    );
  return sleeperDraftPickSchema.parse(await picksRes.json());
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
  const rosterToOwner = await getSleeperOwnerIdForLeague(sleeperLeagueId);
  const userEntry = Array.from(rosterToOwner.entries()).find(
    ([, ownerId]) => ownerId === sleeperOwnerID,
  );
  if (!userEntry) return [];
  const [userRosterId] = userEntry;
  const allPicks = await fetchDraftPicks(sleeperLeagueId);
  return allPicks.filter(p => p.roster_id === userRosterId);
}

export async function syncD12Season(year: number) {
  const season = await getD12SeasonByYear(year);
  if (!season) throw new Error(`No D12 season found for year ${year}`);

  const leagues = await getD12LeaguesBySeasonId(season.id);
  const currentWeek = await getCurrentNFLWeek();

  for (const league of leagues) {
    const { rosterToOwner, ownerToUserId } = await resolveLeagueOwners(
      league.sleeperLeagueId,
    );
    for (let week = 1; week <= currentWeek; week++) {
      await syncD12LeagueWeek(league, week, rosterToOwner, ownerToUserId);
    }
  }
}
