import {
  isPoolDecided,
  poolStartWeek,
  rankEntries,
  readSleeperEntry,
  survivedWeek,
} from './standings';
import type { SurvivorPickInput } from './standings';
import yahooHistory from './yahoo-history.json';
import { Prisma } from '@prisma/client';
import type { SurvivorPool } from '@prisma/client';
import { prisma } from '~/db.server';
import {
  getLeagueInfo,
  getLeagueUsers,
  getSleeperUser,
  getSurvivorRosters,
} from '~/libs/sleeper/api.server';
import { parseSleeperLeagueIdFromUrl } from '~/libs/sleeper/league-url';
import { getOwnerToUserIdMap } from '~/libs/sleeper/owners.server';
import { getYahooGuidToUserIdMap } from '~/models/yahooUser.server';

export type SurvivorSyncResult = {
  unmatchedEntries: number;
};

/** Sleeper's pick'em game type for survivor. */
const SLEEPER_SURVIVOR_TYPE = 1;

type EntryInput = {
  externalId: string;
  displayName: string | null;
  entryName: string | null;
  sleeperOwnerId: string | null;
  yahooGuid: string | null;
  /**
   * Undefined leaves the stored member alone: an entry with no account to
   * match on is assigned by hand on the admin page, and a resync must not
   * wipe that.
   */
  userId: string | null | undefined;
  eliminatedWeek: number | null;
  picks: SurvivorPickInput[];
};

/**
 * Replaces every entry and pick stored for a pool, and settles its finishes
 * once the pool is decided.
 */
async function writePool(
  pool: SurvivorPool,
  entries: EntryInput[],
  { name, sourceComplete }: { name: string; sourceComplete: boolean },
) {
  const isComplete = isPoolDecided({ sourceComplete, entries });
  const reached = entries.map(entry => ({
    key: entry.externalId,
    survivedWeek: survivedWeek(entry.picks),
  }));
  const places = isComplete ? rankEntries(reached) : new Map<string, number>();

  const entryWrites = entries.map((entry, index) => {
    const data = {
      displayName: entry.displayName,
      entryName: entry.entryName,
      sleeperOwnerId: entry.sleeperOwnerId,
      yahooGuid: entry.yahooGuid,
      ...(entry.userId !== undefined ? { userId: entry.userId } : {}),
      eliminatedWeek: entry.eliminatedWeek,
      survivedWeek: reached[index].survivedWeek,
      finish: places.get(entry.externalId) ?? null,
    };
    return prisma.survivorEntry.upsert({
      where: {
        survivorPoolId_externalId: {
          survivorPoolId: pool.id,
          externalId: entry.externalId,
        },
      },
      update: { ...data, picks: { deleteMany: {}, create: entry.picks } },
      create: {
        ...data,
        externalId: entry.externalId,
        survivorPoolId: pool.id,
        picks: { create: entry.picks },
      },
    });
  });

  // One transaction, so a page never reads a pool half rewritten. The hourly
  // job and an admin's Sync can land together, so it locks the pool first and
  // the second one waits.
  await prisma.$transaction([
    prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pool.id}))`,
    prisma.survivorPool.update({
      where: { id: pool.id },
      data: {
        name,
        startWeek: poolStartWeek(entries),
        isComplete,
        lastSyncedAt: new Date(),
      },
    }),
    // An entry the source no longer has - a roster removed from the league -
    // goes, rather than lingering in the counts with a stale place.
    prisma.survivorEntry.deleteMany({
      where: {
        survivorPoolId: pool.id,
        externalId: { notIn: entries.map(entry => entry.externalId) },
      },
    }),
    ...entryWrites,
  ]);

  // Read back rather than worked out, so entries assigned by hand count.
  const unmatchedEntries = await prisma.survivorEntry.count({
    where: { survivorPoolId: pool.id, userId: null },
  });
  return { unmatchedEntries };
}

/**
 * The Sleeper league ID behind a pasted link: a league URL, a bare ID, or the
 * invite link a pool is shared with (sleeper.com/i/<code>), which only the
 * invite page itself can turn into a league.
 */
async function resolveSleeperPool(input: string) {
  const invite = /sleeper\.(?:com|app)\/i\/([A-Za-z0-9]+)/.exec(input);
  if (!invite) {
    return { sleeperLeagueId: parseSleeperLeagueIdFromUrl(input) };
  }

  const inviteUrl = `https://sleeper.com/i/${invite[1]}`;
  const res = await fetch(inviteUrl);
  if (!res.ok) {
    throw new Error(`Sleeper's invite page answered ${res.status}.`);
  }
  // The page embeds the league as escaped JSON: \"league_id\":\"123...\".
  const match = /league_id\\?"\s*:\s*\\?"(\d+)/.exec(await res.text());
  if (!match) {
    throw new Error(
      'That invite link did not lead to a league. Paste the league URL instead.',
    );
  }
  return { sleeperLeagueId: match[1], inviteUrl };
}

/**
 * Adds a Sleeper survivor pool from its URL or invite link and syncs it. The
 * year and name come from Sleeper.
 */
export async function addSleeperSurvivorPool(input: string) {
  const { sleeperLeagueId, inviteUrl } = await resolveSleeperPool(input.trim());

  const existing = await prisma.survivorPool.findUnique({
    where: { externalId: sleeperLeagueId },
  });
  if (existing) {
    throw new Error(`"${existing.name}" has already been added.`);
  }

  const info = await getLeagueInfo(sleeperLeagueId);
  if (
    info.sport !== 'pickem:nfl' ||
    info.settings?.pickem_type !== SLEEPER_SURVIVOR_TYPE
  ) {
    throw new Error(`"${info.name}" is not a Sleeper survivor pool.`);
  }
  const year = Number(info.season);
  if (!Number.isInteger(year)) {
    throw new Error(`Sleeper did not say which season "${info.name}" is.`);
  }

  const pool = await prisma.survivorPool
    .create({
      data: {
        year,
        name: info.name,
        source: 'SLEEPER',
        externalId: sleeperLeagueId,
        inviteUrl,
      },
    })
    .catch((e: unknown) => {
      // Two adds of the same pool at once (a double-clicked button): the
      // check above passed for both, and the second loses on the unique key.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new Error(`"${info.name}" has already been added.`);
      }
      throw e;
    });

  // The pool is kept even if its first sync fails, so the admin can retry from
  // its Sync button rather than add it again.
  try {
    return { pool, warning: null, ...(await syncSleeperSurvivorPool(pool)) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      pool,
      warning: `The first sync failed (${message}). Press Sync to try again.`,
      unmatchedEntries: 0,
    };
  }
}

/**
 * Everything Sleeper has on a pool - three requests, so it is cheap enough to
 * run whole every time.
 */
export async function syncSleeperSurvivorPool(
  pool: SurvivorPool,
  ownerToUserId?: Map<string, string>,
): Promise<SurvivorSyncResult> {
  if (pool.source !== 'SLEEPER') {
    throw new Error(`"${pool.name}" was played on Yahoo and cannot be synced.`);
  }

  const id = pool.externalId;
  const [info, rosters, users, owners] = await Promise.all([
    getLeagueInfo(id),
    getSurvivorRosters(id),
    getLeagueUsers(id),
    ownerToUserId ? Promise.resolve(ownerToUserId) : getOwnerToUserIdMap(),
  ]);

  const nameByOwner = new Map(
    users.map(user => [user.user_id, user.display_name ?? user.username]),
  );
  // Someone who left the pool is no longer in its users list. Their name is
  // looked up one by one; a failed lookup only costs the name.
  const departed = rosters
    .map(roster => roster.owner_id)
    .filter((owner): owner is string => !!owner && !nameByOwner.has(owner));
  const departedUsers = await Promise.all(
    departed.map(owner => getSleeperUser(owner).catch(() => null)),
  );
  for (const user of departedUsers) {
    if (user) nameByOwner.set(user.user_id, user.display_name ?? user.username);
  }

  const sourceComplete = info.status === 'complete';
  const entries: EntryInput[] = rosters.map(roster => {
    const ownerId = roster.owner_id;
    return {
      externalId: String(roster.roster_id),
      displayName: ownerId ? nameByOwner.get(ownerId) ?? null : null,
      entryName: null,
      sleeperOwnerId: ownerId,
      yahooGuid: null,
      userId: ownerId ? owners.get(ownerId) ?? null : undefined,
      ...readSleeperEntry(roster.metadata, { poolIsOver: sourceComplete }),
    };
  });

  return writePool(pool, entries, {
    name: info.name,
    sourceComplete,
  });
}

/**
 * Loads the Yahoo pools (2022-2023) from the bundled history file, creating
 * any that are missing and rewriting the rest. Safe to run again: members
 * already matched stay matched.
 */
export async function importYahooHistory() {
  const guidToUserId = await getYahooGuidToUserIdMap();
  let unmatchedEntries = 0;

  for (const source of yahooHistory.pools) {
    const pool = await prisma.survivorPool.upsert({
      where: { externalId: source.groupKey },
      update: {},
      create: {
        year: source.year,
        name: source.name,
        source: 'YAHOO',
        externalId: source.groupKey,
      },
    });

    const result = await writePool(
      pool,
      source.entries.map(entry => ({
        externalId: entry.teamKey,
        displayName: entry.nickname,
        entryName: entry.entryName,
        sleeperOwnerId: null,
        yahooGuid: entry.guid,
        userId: entry.guid ? guidToUserId.get(entry.guid) ?? null : undefined,
        eliminatedWeek: entry.eliminatedWeek,
        picks: entry.picks as SurvivorPickInput[],
      })),
      { name: source.name, sourceComplete: true },
    );
    unmatchedEntries += result.unmatchedEntries;
  }

  return { pools: yahooHistory.pools.length, unmatchedEntries };
}

/**
 * Syncs every Sleeper pool of a year. All of them, not only the undecided
 * ones: a pool down to one entry is decided but still being picked in, and
 * a season holds two or three pools at most.
 *
 * @returns one message per pool that failed.
 */
export async function syncActiveSurvivorPools(year: number) {
  const pools = await prisma.survivorPool.findMany({
    where: { year, source: 'SLEEPER' },
  });
  if (pools.length === 0) return [];

  const owners = await getOwnerToUserIdMap();
  const messages: string[] = [];
  await Promise.all(
    pools.map(async pool => {
      try {
        await syncSleeperSurvivorPool(pool, owners);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        messages.push(`"${pool.name}": ${msg}`);
      }
    }),
  );
  return messages;
}
