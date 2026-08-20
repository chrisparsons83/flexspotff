import type { Prisma, User } from '@prisma/client';
import { prisma } from '~/db.server';
import { namesLookAlike, normalizeName } from '~/utils/names';

export type MergeUser = Pick<
  User,
  'id' | 'discordId' | 'discordName' | 'mergedIntoId'
>;

export type MergeTablePlan = {
  /** Prisma model key, used to look the write statement back up on apply. */
  table: MergeTableName;
  label: string;
  movingIds: string[];
  stayingIds: string[];
  /** Rows dragged along by a database-level cascade. Display only. */
  cascaded?: { label: string; moving: number; staying: number }[];
  /** Why the staying rows cannot move, phrased for an admin. */
  stayingReason?: string;
};

export type MergePlan = {
  duplicate: MergeUser;
  canonical: MergeUser;
  tables: MergeTablePlan[];
  /** Users already merged into the duplicate, re-pointed at the canonical. */
  tombstonesToRepoint: string[];
  warnings: string[];
  totalMoving: number;
  totalStaying: number;
};

/** A merge that should not happen, phrased for an admin rather than a log. */
export class MergeGuardError extends Error {}

/**
 * Splits the duplicate's rows into the ones that can move and the ones whose
 * slot the canonical member already occupies. Slots claimed by an earlier row
 * in this same pass count as taken too, so a table with a logical-only
 * uniqueness rule does not get two rows moved into one slot.
 */
const partitionBySlot = <T>(
  duplicateRows: T[],
  canonicalRows: T[],
  slotOf: (row: T) => string,
  keyOf: (row: T) => string,
) => {
  const taken = new Set(canonicalRows.map(slotOf));
  const movingIds: string[] = [];
  const stayingIds: string[] = [];

  for (const row of duplicateRows) {
    const slot = slotOf(row);
    if (taken.has(slot)) {
      stayingIds.push(keyOf(row));
    } else {
      taken.add(slot);
      movingIds.push(keyOf(row));
    }
  }

  return { movingIds, stayingIds };
};

/**
 * Every table that hangs off a member, in the order the merge writes them.
 *
 * `slotOf` is what makes a row un-moveable: if the canonical member already
 * owns a row with the same slot, moving the duplicate's row would either
 * violate a unique constraint or - for the tables marked logical-only, which
 * have no database constraint - silently double-count that person in a
 * standings page. Tables with no `slotOf` can never collide, so all of their
 * rows move.
 */
const MERGE_TABLES = [
  {
    table: 'team',
    label: 'League teams',
    select: {},
    // Nothing keys a team to one per member per anything - a member can own
    // teams in several leagues in the same year.
    slotOf: null,
  },
  {
    table: 'sleeperUser',
    label: 'Sleeper account links',
    select: {},
    slotOf: null,
    // The only table with no `id` column - a Sleeper link is identified by the
    // Sleeper account it points at.
    pk: 'sleeperOwnerID' as const,
  },
  {
    table: 'registration',
    label: 'Season registrations',
    select: { year: true },
    slotOf: (row: { year: number }) => String(row.year),
    stayingReason: 'already registered for that season',
  },
  {
    table: 'episode',
    label: 'Podcast episodes',
    select: {},
    slotOf: null,
    // The only table that keys a member with something other than userId.
    column: 'authorId' as const,
  },
  {
    table: 'fSquaredEntry',
    label: 'F² entries',
    select: { year: true },
    slotOf: (row: { year: number }) => String(row.year),
    stayingReason: 'already has an entry that year',
  },
  {
    table: 'poolGamePick',
    label: 'Spread pool picks',
    select: { poolGameId: true, teamBetId: true },
    slotOf: (row: { poolGameId: string; teamBetId: string }) =>
      `${row.poolGameId}:${row.teamBetId}`,
    stayingReason: 'already has that pick',
  },
  {
    table: 'poolWeekMissed',
    label: 'Spread pool missed weeks',
    select: { poolWeekId: true },
    slotOf: (row: { poolWeekId: string | null }) => row.poolWeekId ?? '',
    stayingReason: 'already marked missed that week',
  },
  {
    table: 'locksGamePick',
    label: 'Locks challenge picks',
    select: { locksGameId: true, teamBetId: true },
    slotOf: (row: { locksGameId: string; teamBetId: string }) =>
      `${row.locksGameId}:${row.teamBetId}`,
    stayingReason: 'already has that pick',
  },
  {
    table: 'qBSelection',
    label: 'QB streaming selections',
    select: { qbStreamingWeekId: true },
    // No database constraint, but two selections in one week would double the
    // person's score in the standings.
    slotOf: (row: { qbStreamingWeekId: string }) => row.qbStreamingWeekId,
    stayingReason: 'already has a selection that week',
  },
  {
    table: 'draftSlotPreference',
    label: 'Draft slot preferences',
    select: { draftSlotId: true },
    slotOf: (row: { draftSlotId: string }) => row.draftSlotId,
    stayingReason: 'already ranked that slot',
  },
  {
    table: 'omniUserTeam',
    label: 'Omni teams',
    select: { seasonId: true },
    // getOmniUserTeamByUserIdAndSeason uses findFirst, so a second team for one
    // season would be silently ignored rather than merged.
    slotOf: (row: { seasonId: string }) => row.seasonId,
    stayingReason: 'already has an Omni team that season',
  },
  {
    table: 'd12WeekScore',
    label: 'D12 week scores',
    select: { d12LeagueId: true, week: true },
    slotOf: (row: { d12LeagueId: string; week: number }) =>
      `${row.d12LeagueId}:${row.week}`,
    stayingReason: 'already has a score for that week',
  },
  {
    table: 'd12DraftPick',
    label: 'D12 draft picks',
    select: {},
    slotOf: null,
  },
  {
    table: 'dFSSurvivorUserYear',
    label: 'DFS Survivor seasons',
    select: { year: true },
    slotOf: (row: { year: number }) => String(row.year),
    stayingReason: 'already played DFS Survivor that season',
  },
] as const;

export type MergeTableName = (typeof MERGE_TABLES)[number]['table'];

const columnFor = (table: MergeTableName) =>
  table === 'episode' ? 'authorId' : 'userId';

const pkFor = (table: MergeTableName) =>
  table === 'sleeperUser' ? 'sleeperOwnerID' : 'id';

// $transaction only accepts Prisma's own promise type, and Prisma 3 does not
// re-export it under a stable name - derive it from a real delegate instead.
type UpdateManyPromise = ReturnType<typeof prisma.team.updateMany>;

const delegateFor = (table: MergeTableName) =>
  prisma[table] as unknown as {
    findMany: (args: unknown) => Promise<Record<string, string>[]>;
    updateMany: (args: unknown) => UpdateManyPromise;
  };

const selectUser = {
  id: true,
  discordId: true,
  discordName: true,
  mergedIntoId: true,
} as const;

/**
 * Works out what a merge would do, without touching anything. Safe to call
 * from a loader, and re-run inside mergeUsers so the plan the admin confirmed
 * is never the plan that gets trusted.
 */
export async function planUserMerge(
  duplicateId: string,
  canonicalId: string,
): Promise<MergePlan> {
  if (!duplicateId || !canonicalId) {
    throw new MergeGuardError(
      'Pick both a duplicate member and the member to merge them into.',
    );
  }

  if (duplicateId === canonicalId) {
    throw new MergeGuardError("A member can't be merged into themselves.");
  }

  const found = await prisma.user.findMany({
    where: { id: { in: [duplicateId, canonicalId] } },
    select: selectUser,
  });
  const duplicate = found.find(user => user.id === duplicateId);
  const canonical = found.find(user => user.id === canonicalId);

  if (!duplicate || !canonical) {
    throw new MergeGuardError(
      'One of those members no longer exists. Reload the page and try again.',
    );
  }

  // Following the chain here would quietly redirect the admin's choice, and
  // letting chains form would mean tombstone resolution needs a loop. Refusing
  // keeps the invariant that a tombstone always points at a live member.
  if (canonical.mergedIntoId) {
    const target = await prisma.user.findUnique({
      where: { id: canonical.mergedIntoId },
      select: { discordName: true },
    });
    throw new MergeGuardError(
      `${canonical.discordName} was already merged into ${
        target?.discordName ?? 'another member'
      }. Merge into ${target?.discordName ?? 'that member'} instead.`,
    );
  }

  // Re-running a merge that already happened is allowed and useful: anything
  // that landed on the tombstone afterwards, from a session that was still
  // logged in as them, gets swept up.
  if (duplicate.mergedIntoId && duplicate.mergedIntoId !== canonicalId) {
    const target = await prisma.user.findUnique({
      where: { id: duplicate.mergedIntoId },
      select: { discordName: true },
    });
    throw new MergeGuardError(
      `${duplicate.discordName} was already merged into ${
        target?.discordName ?? 'another member'
      }. Merge ${target?.discordName ?? 'that member'} into ${
        canonical.discordName
      } instead.`,
    );
  }

  const tables: MergeTablePlan[] = [];

  for (const config of MERGE_TABLES) {
    const column = columnFor(config.table);
    const pk = pkFor(config.table);
    const delegate = delegateFor(config.table);
    const select = { [pk]: true, ...config.select };

    const [duplicateRows, canonicalRows] = await Promise.all([
      delegate.findMany({ where: { [column]: duplicateId }, select }),
      config.slotOf
        ? delegate.findMany({ where: { [column]: canonicalId }, select })
        : Promise.resolve([]),
    ]);

    const keyOf = (row: Record<string, string>) => row[pk];

    const { movingIds, stayingIds } = config.slotOf
      ? partitionBySlot(
          duplicateRows,
          canonicalRows,
          config.slotOf as unknown as (row: Record<string, string>) => string,
          keyOf,
        )
      : { movingIds: duplicateRows.map(keyOf), stayingIds: [] };

    if (!movingIds.length && !stayingIds.length) {
      continue;
    }

    tables.push({
      table: config.table,
      label: config.label,
      movingIds,
      stayingIds,
      stayingReason: stayingIds.length
        ? 'stayingReason' in config
          ? config.stayingReason
          : undefined
        : undefined,
      cascaded:
        config.table === 'dFSSurvivorUserYear'
          ? await countDfsCascade(duplicateId, movingIds, stayingIds)
          : undefined,
    });
  }

  const tombstones = await prisma.user.findMany({
    where: { mergedIntoId: duplicateId },
    select: { id: true },
  });

  return {
    duplicate,
    canonical,
    tables,
    tombstonesToRepoint: tombstones.map(user => user.id),
    warnings: await buildWarnings(duplicate, canonical),
    totalMoving: tables.reduce((sum, t) => sum + t.movingIds.length, 0),
    totalStaying: tables.reduce((sum, t) => sum + t.stayingIds.length, 0),
  };
}

/**
 * DFS Survivor weeks and entries are not written directly - they ride a
 * database ON UPDATE CASCADE from the season row. They still need counting so
 * the preview can say what a season actually carries with it.
 */
async function countDfsCascade(
  duplicateId: string,
  movingYearIds: string[],
  stayingYearIds: string[],
) {
  const yearsFor = async (ids: string[]) =>
    ids.length
      ? (
          await prisma.dFSSurvivorUserYear.findMany({
            where: { id: { in: ids } },
            select: { year: true },
          })
        ).map(row => row.year)
      : [];

  const [movingYears, stayingYears] = await Promise.all([
    yearsFor(movingYearIds),
    yearsFor(stayingYearIds),
  ]);

  const countIn = async (
    model: 'dFSSurvivorUserWeek' | 'dFSSurvivorUserEntry',
    years: number[],
  ) =>
    years.length
      ? model === 'dFSSurvivorUserWeek'
        ? prisma.dFSSurvivorUserWeek.count({
            where: { userId: duplicateId, year: { in: years } },
          })
        : prisma.dFSSurvivorUserEntry.count({
            where: { userId: duplicateId, year: { in: years } },
          })
      : 0;

  const [weeksMoving, weeksStaying, entriesMoving, entriesStaying] =
    await Promise.all([
      countIn('dFSSurvivorUserWeek', movingYears),
      countIn('dFSSurvivorUserWeek', stayingYears),
      countIn('dFSSurvivorUserEntry', movingYears),
      countIn('dFSSurvivorUserEntry', stayingYears),
    ]);

  return [
    { label: 'DFS Survivor weeks', moving: weeksMoving, staying: weeksStaying },
    {
      label: 'DFS Survivor entries',
      moving: entriesMoving,
      staying: entriesStaying,
    },
  ];
}

/** Signals that the two members picked might not be the same human at all. */
async function buildWarnings(duplicate: MergeUser, canonical: MergeUser) {
  const warnings: string[] = [];

  const [duplicateTeams, canonicalTeams] = await Promise.all([
    prisma.team.findMany({
      where: { userId: duplicate.id },
      select: {
        leagueId: true,
        league: { select: { name: true, year: true } },
      },
    }),
    prisma.team.findMany({
      where: { userId: canonical.id },
      select: { leagueId: true },
    }),
  ]);

  const canonicalLeagueIds = new Set(canonicalTeams.map(t => t.leagueId));
  const shared = duplicateTeams.filter(team =>
    canonicalLeagueIds.has(team.leagueId),
  );

  if (shared.length) {
    const names = [
      ...new Set(shared.map(t => `${t.league.year} ${t.league.name}`)),
    ].join(', ');
    warnings.push(
      `${duplicate.discordName} and ${canonical.discordName} both own a team in ${names}. Two teams in one league is a strong sign these are different people - check before merging.`,
    );
  }

  if (!namesLookAlike(duplicate.discordName, canonical.discordName)) {
    warnings.push(
      `"${duplicate.discordName}" and "${canonical.discordName}" don't look like the same name. Double-check this is the right pair.`,
    );
  }

  return warnings;
}

/**
 * Moves everything the duplicate owns onto the canonical member and leaves the
 * duplicate behind as a tombstone.
 *
 * The plan is recomputed here rather than taken from the caller, so a stale
 * preview can never drive the write. Nothing is ever deleted: rows whose slot
 * the canonical already occupies simply stay put.
 */
export async function mergeUsers(
  duplicateId: string,
  canonicalId: string,
  performedById: string,
) {
  const plan = await planUserMerge(duplicateId, canonicalId);

  const movedRows: Record<string, string[]> = {};
  for (const table of plan.tables) {
    if (table.movingIds.length) {
      movedRows[table.table] = table.movingIds;
    }
  }
  movedRows._tombstones = plan.tombstonesToRepoint;

  const writes = plan.tables
    .filter(table => table.movingIds.length)
    .map(table =>
      delegateFor(table.table).updateMany({
        where: { [pkFor(table.table)]: { in: table.movingIds } },
        data: { [columnFor(table.table)]: canonicalId },
      }),
    );

  // Prisma 3 has no interactive transactions without a preview flag, so this is
  // the array form. Every statement targets rows by primary key and every
  // destination slot was proven free above, so ordering does not matter.
  const results = await prisma.$transaction([
    ...writes,

    // Keep the tombstone graph one hop deep. If someone was already merged into
    // the duplicate they have to follow it here, or resolving their login would
    // need to walk a chain that could cycle.
    prisma.user.updateMany({
      where: { mergedIntoId: duplicateId },
      data: { mergedIntoId: canonicalId },
    }),

    // Conditional on the duplicate still being unmerged (or already merged
    // into this same member, for a re-run). Two admins merging at once would
    // otherwise build a two-hop chain, and getUserByDiscordId only follows one.
    prisma.user.updateMany({
      where: {
        id: duplicateId,
        OR: [{ mergedIntoId: null }, { mergedIntoId: canonicalId }],
      },
      data: { mergedIntoId: canonicalId, mergedAt: new Date() },
    }),

    prisma.userMerge.create({
      data: {
        duplicateId,
        canonicalId,
        performedById,
        movedRows: movedRows as Prisma.InputJsonValue,
      },
    }),
  ]);

  // The tombstone write is the second-to-last statement. Zero rows means the
  // duplicate was merged somewhere else between the plan and the write, so the
  // data moved but the link did not - say so rather than reporting success.
  const { count: tombstoned } = results[results.length - 2] as {
    count: number;
  };
  if (tombstoned === 0) {
    throw new MergeGuardError(
      `${plan.duplicate.discordName} was merged by someone else while this was running. Their data moved to ${plan.canonical.discordName}, but run the preview again to check where they now point.`,
    );
  }

  return plan;
}

export type DuplicateCandidate = {
  left: MergeUser & { teamCount: number };
  right: MergeUser & { teamCount: number };
  reason: string;
  /** Lower sorts first. Structural signals beat name similarity. */
  rank: number;
};

/**
 * Finds pairs of live members who look like one person.
 *
 * The strongest signal is structural rather than textual: Team.sleeperOwnerId
 * is a plain column, so one Sleeper account whose teams point at two different
 * members is close to conclusive. Name similarity is the fallback, and has to
 * allow containment - the case this whole feature exists for is "Panda" and
 * "pandabair", which no equality check would ever surface.
 */
export async function findDuplicateCandidates(): Promise<DuplicateCandidate[]> {
  const members = await prisma.user.findMany({
    where: { mergedIntoId: null },
    select: { ...selectUser, _count: { select: { teams: true } } },
    orderBy: { discordName: 'asc' },
  });

  const byId = new Map(
    members.map(member => [
      member.id,
      {
        id: member.id,
        discordId: member.discordId,
        discordName: member.discordName,
        mergedIntoId: member.mergedIntoId,
        teamCount: member._count.teams,
      },
    ]),
  );

  const candidates = new Map<string, DuplicateCandidate>();
  const add = (
    leftId: string,
    rightId: string,
    reason: string,
    rank: number,
  ) => {
    const left = byId.get(leftId);
    const right = byId.get(rightId);
    if (!left || !right) return;

    // Propose the member with less history as the duplicate, since that is the
    // one an admin almost always wants to fold away.
    const [dup, canon] =
      left.teamCount <= right.teamCount ? [left, right] : [right, left];
    const key = [dup.id, canon.id].join(':');
    const existing = candidates.get(key);
    if (existing && existing.rank <= rank) return;

    candidates.set(key, { left: dup, right: canon, reason, rank });
  };

  const teams = await prisma.team.findMany({
    where: { userId: { not: null } },
    select: { sleeperOwnerId: true, userId: true },
  });

  const membersBySleeperOwner = new Map<string, Set<string>>();
  for (const team of teams) {
    if (!team.userId || !byId.has(team.userId)) continue;
    const owners = membersBySleeperOwner.get(team.sleeperOwnerId) ?? new Set();
    owners.add(team.userId);
    membersBySleeperOwner.set(team.sleeperOwnerId, owners);
  }

  for (const [sleeperOwnerId, userIds] of membersBySleeperOwner) {
    if (userIds.size < 2) continue;
    const ids = [...userIds];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        add(
          ids[i],
          ids[j],
          `Both own teams under Sleeper account ${sleeperOwnerId}`,
          0,
        );
      }
    }
  }

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const left = members[i];
      const right = members[j];
      if (!namesLookAlike(left.discordName, right.discordName)) continue;

      const same =
        normalizeName(left.discordName) === normalizeName(right.discordName);
      add(
        left.id,
        right.id,
        same ? 'Same name' : 'One name contains the other',
        same ? 1 : 2,
      );
    }
  }

  return [...candidates.values()].sort(
    (a, b) =>
      a.rank - b.rank || a.left.discordName.localeCompare(b.left.discordName),
  );
}

/**
 * Tombstones that still own rows. A member who was already logged in when they
 * were merged keeps submitting as themselves until their session cookie
 * expires, so this is how that shows up and gets swept away by a re-merge.
 */
export async function getMergedUsersWithLeftovers() {
  const merged = await prisma.user.findMany({
    where: { mergedIntoId: { not: null } },
    select: {
      ...selectUser,
      mergedAt: true,
      mergedInto: { select: { id: true, discordName: true } },
      // Every relation MERGE_TABLES can move needs counting here. A table left
      // out reports zero leftovers, and the merge page hides its re-merge
      // button when the total is zero - so the one case this list exists to
      // surface would be the one case it stays invisible.
      _count: {
        select: {
          teams: true,
          sleeperUsers: true,
          registrations: true,
          episodes: true,
          fSquaredEntries: true,
          poolGamePicks: true,
          poolWeeksMissed: true,
          locksGamePick: true,
          QBSelections: true,
          draftSlotPreferences: true,
          omniTeams: true,
          d12WeekScores: true,
          d12DraftPicks: true,
          dfsSurvivorUserYears: true,
          dfsSurvivorUserWeeks: true,
        },
      },
    },
    orderBy: { mergedAt: 'desc' },
  });

  return merged.map(user => ({
    ...user,
    leftoverCount: Object.values(user._count).reduce(
      (sum, count) => sum + count,
      0,
    ),
  }));
}
