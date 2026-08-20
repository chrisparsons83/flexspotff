import { getCareerRecords } from './records.server';
import {
  MergeGuardError,
  getMergedUsersWithLeftovers,
  mergeUsers,
  planUserMerge,
} from './userMerge.server';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '~/db.server';
import { truncateDB } from '~/utils/vitest';

const makeUser = (name: string) =>
  prisma.user.create({
    data: {
      discordId: `discord-${name}`,
      discordName: name,
      discordAvatar: '',
    },
  });

const makeLeague = (year: number, name = 'Champions') =>
  prisma.league.create({
    data: {
      year,
      name,
      sleeperLeagueId: `league-${year}-${name}`,
      sleeperDraftId: `draft-${year}-${name}`,
      tier: 1,
      isActive: true,
    },
  });

const makeTeam = (
  userId: string,
  leagueId: string,
  wins: number,
  losses: number,
  sleeperOwnerId = `owner-${userId}`,
) =>
  prisma.team.create({
    data: {
      userId,
      leagueId,
      sleeperOwnerId,
      wins,
      losses,
      ties: 0,
      pointsFor: 100 * (wins + losses),
      pointsAgainst: 90 * (wins + losses),
      rosterId: 1,
    },
  });

/** Mirrors createDfsSurvivorYear, which eagerly creates all 17 week rows. */
const makeDfsYear = async (userId: string, year: number) => {
  const created = await prisma.dFSSurvivorUserYear.create({
    data: { userId, year, points: 12 },
  });
  for (let week = 1; week <= 17; week++) {
    await prisma.dFSSurvivorUserWeek.create({
      data: { userId, year, week, isScored: false },
    });
  }
  return created;
};

describe('userMerge', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('collapses two career lines into one', async () => {
    const [panda, pandabair, admin] = await Promise.all([
      makeUser('Panda'),
      makeUser('pandabair'),
      makeUser('Admin'),
    ]);
    const [league2022, league2023] = await Promise.all([
      makeLeague(2022),
      makeLeague(2023),
    ]);

    await makeTeam(panda.id, league2022.id, 10, 4);
    await makeTeam(pandabair.id, league2023.id, 8, 6);

    const before = await getCareerRecords();
    const beforeWins = before.find(t => t.title === 'Most Career Wins')!;
    expect(beforeWins.rows).toHaveLength(2);

    await mergeUsers(panda.id, pandabair.id, admin.id);

    const after = await getCareerRecords();
    const afterWins = after.find(t => t.title === 'Most Career Wins')!;

    expect(afterWins.rows).toHaveLength(1);
    expect(afterWins.rows[0].cells).toEqual([
      'pandabair',
      '18',
      '18-10-0',
      '2',
    ]);
  });

  it('moves Sleeper links so future syncs land on the canonical member', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Dup'),
      makeUser('Canon'),
      makeUser('Admin'),
    ]);
    await prisma.sleeperUser.create({
      data: { sleeperOwnerID: 'sleeper-1', userId: dup.id },
    });

    await mergeUsers(dup.id, canon.id, admin.id);

    const link = await prisma.sleeperUser.findUnique({
      where: { sleeperOwnerID: 'sleeper-1' },
    });
    expect(link?.userId).toBe(canon.id);
  });

  it('moves non-colliding entries and leaves colliding ones behind', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Dup'),
      makeUser('Canon'),
      makeUser('Admin'),
    ]);

    await prisma.fSquaredEntry.create({ data: { userId: dup.id, year: 2022 } });
    await prisma.fSquaredEntry.create({ data: { userId: dup.id, year: 2023 } });
    await prisma.fSquaredEntry.create({
      data: { userId: canon.id, year: 2023 },
    });

    const plan = await mergeUsers(dup.id, canon.id, admin.id);
    const entries = plan.tables.find(t => t.table === 'fSquaredEntry')!;

    expect(entries.movingIds).toHaveLength(1);
    expect(entries.stayingIds).toHaveLength(1);

    const moved = await prisma.fSquaredEntry.findMany({
      where: { userId: canon.id },
      select: { year: true },
      orderBy: { year: 'asc' },
    });
    expect(moved.map(e => e.year)).toEqual([2022, 2023]);

    // Nothing is deleted - the colliding entry stays put on the tombstone.
    const left = await prisma.fSquaredEntry.findMany({
      where: { userId: dup.id },
      select: { year: true },
    });
    expect(left.map(e => e.year)).toEqual([2023]);
  });

  it('moves DFS Survivor weeks and entries by database cascade', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Dup'),
      makeUser('Canon'),
      makeUser('Admin'),
    ]);
    await makeDfsYear(dup.id, 2023);

    await mergeUsers(dup.id, canon.id, admin.id);

    // The merge only ever writes DFSSurvivorUserYear. If the cascade did not
    // fire, these weeks would still carry the duplicate's id.
    const weeks = await prisma.dFSSurvivorUserWeek.findMany({
      where: { userId: canon.id, year: 2023 },
    });
    expect(weeks).toHaveLength(17);

    const leftBehind = await prisma.dFSSurvivorUserWeek.count({
      where: { userId: dup.id },
    });
    expect(leftBehind).toBe(0);
  });

  it('leaves a contested DFS Survivor season entirely alone', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Dup'),
      makeUser('Canon'),
      makeUser('Admin'),
    ]);
    await makeDfsYear(dup.id, 2023);
    await makeDfsYear(canon.id, 2023);
    await makeDfsYear(dup.id, 2024);

    await mergeUsers(dup.id, canon.id, admin.id);

    // 2024 moves whole; 2023 stays whole, because year creation makes all 17
    // weeks up front so every week of a contested season collides.
    const canonYears = await prisma.dFSSurvivorUserYear.findMany({
      where: { userId: canon.id },
      select: { year: true },
      orderBy: { year: 'asc' },
    });
    expect(canonYears.map(y => y.year)).toEqual([2023, 2024]);

    const dupYears = await prisma.dFSSurvivorUserYear.findMany({
      where: { userId: dup.id },
      select: { year: true },
    });
    expect(dupYears.map(y => y.year)).toEqual([2023]);

    expect(
      await prisma.dFSSurvivorUserWeek.count({
        where: { userId: dup.id, year: 2023 },
      }),
    ).toBe(17);
    expect(
      await prisma.dFSSurvivorUserWeek.count({
        where: { userId: canon.id, year: 2024 },
      }),
    ).toBe(17);
  });

  it('moves podcast episodes, which key the member as authorId', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Dup'),
      makeUser('Canon'),
      makeUser('Admin'),
    ]);
    await prisma.episode.create({
      data: {
        authorId: dup.id,
        description: 'd',
        duration: 1,
        episode: 1,
        filepath: 'f',
        filesize: 1,
        publishDate: new Date(),
        season: 1,
        shownotes: '',
        title: 'Ep 1',
      },
    });

    await mergeUsers(dup.id, canon.id, admin.id);

    expect(await prisma.episode.count({ where: { authorId: canon.id } })).toBe(
      1,
    );
  });

  it('keeps the tombstone graph one hop deep', async () => {
    const [a, b, c, admin] = await Promise.all([
      makeUser('A'),
      makeUser('B'),
      makeUser('C'),
      makeUser('Admin'),
    ]);

    await mergeUsers(a.id, b.id, admin.id);
    await mergeUsers(b.id, c.id, admin.id);

    const refreshedA = await prisma.user.findUnique({ where: { id: a.id } });
    expect(refreshedA?.mergedIntoId).toBe(c.id);
  });

  it('is safe to re-run for the same pair', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Dup'),
      makeUser('Canon'),
      makeUser('Admin'),
    ]);
    const league = await makeLeague(2023);
    await makeTeam(dup.id, league.id, 5, 5);

    await mergeUsers(dup.id, canon.id, admin.id);

    // Something lands on the tombstone afterwards, as a stale session would.
    const league2 = await makeLeague(2024);
    await makeTeam(dup.id, league2.id, 7, 3);

    const second = await mergeUsers(dup.id, canon.id, admin.id);

    expect(second.tables.find(t => t.table === 'team')?.movingIds).toHaveLength(
      1,
    );
    expect(await prisma.team.count({ where: { userId: dup.id } })).toBe(0);
    expect(await prisma.team.count({ where: { userId: canon.id } })).toBe(2);
  });

  it('records what moved so the merge can be undone later', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Dup'),
      makeUser('Canon'),
      makeUser('Admin'),
    ]);
    const league = await makeLeague(2023);
    const team = await makeTeam(dup.id, league.id, 5, 5);

    await mergeUsers(dup.id, canon.id, admin.id);

    const record = await prisma.userMerge.findFirst({
      where: { duplicateId: dup.id },
    });
    expect(record?.performedById).toBe(admin.id);
    expect((record?.movedRows as Record<string, string[]>).team).toEqual([
      team.id,
    ]);
  });

  it('counts leftovers in every table a merge can move', async () => {
    const [dup, canon, admin] = await Promise.all([
      makeUser('Dup'),
      makeUser('Canon'),
      makeUser('Admin'),
    ]);

    await mergeUsers(dup.id, canon.id, admin.id);

    // Something lands on the tombstone afterwards, as a stale session would -
    // in a table that is easy to leave out of the count.
    await prisma.episode.create({
      data: {
        authorId: dup.id,
        description: 'd',
        duration: 1,
        episode: 2,
        filepath: 'f',
        filesize: 1,
        publishDate: new Date(),
        season: 1,
        shownotes: '',
        title: 'Ep 2',
      },
    });

    const merged = await getMergedUsersWithLeftovers();
    const tombstone = merged.find(user => user.id === dup.id);

    // The merge page hides its re-merge button when this is zero, so a missed
    // table would make exactly this case invisible.
    expect(tombstone?.leftoverCount).toBe(1);
  });

  it('refuses to relink a duplicate another merge already claimed', async () => {
    const [a, b, c, admin] = await Promise.all([
      makeUser('A'),
      makeUser('B'),
      makeUser('C'),
      makeUser('Admin'),
    ]);

    const plan = await planUserMerge(a.id, b.id);
    expect(plan.duplicate.id).toBe(a.id);

    // Another admin gets there first, between the plan above and the write.
    await mergeUsers(a.id, c.id, admin.id);

    await expect(mergeUsers(a.id, b.id, admin.id)).rejects.toThrow(
      MergeGuardError,
    );

    // A still points at C - one hop, not a chain through B.
    const refreshedA = await prisma.user.findUnique({ where: { id: a.id } });
    expect(refreshedA?.mergedIntoId).toBe(c.id);
  });

  describe('guards', () => {
    it('refuses to merge a member into themselves', async () => {
      const user = await makeUser('Solo');
      await expect(planUserMerge(user.id, user.id)).rejects.toThrow(
        MergeGuardError,
      );
    });

    it('refuses a member that does not exist', async () => {
      const user = await makeUser('Real');
      await expect(planUserMerge(user.id, 'nope')).rejects.toThrow(
        MergeGuardError,
      );
    });

    it('refuses to merge into a tombstone and names the real target', async () => {
      const [a, b, c, admin] = await Promise.all([
        makeUser('A'),
        makeUser('B'),
        makeUser('C'),
        makeUser('Admin'),
      ]);
      await mergeUsers(b.id, c.id, admin.id);

      await expect(planUserMerge(a.id, b.id)).rejects.toThrow(/merged into C/);
    });

    it('refuses a duplicate already merged somewhere else', async () => {
      const [a, b, c, admin] = await Promise.all([
        makeUser('A'),
        makeUser('B'),
        makeUser('C'),
        makeUser('Admin'),
      ]);
      await mergeUsers(a.id, b.id, admin.id);

      await expect(planUserMerge(a.id, c.id)).rejects.toThrow(
        /was already merged into B/,
      );
    });

    it('warns when both members own a team in the same league', async () => {
      const [dup, canon] = await Promise.all([
        makeUser('Panda'),
        makeUser('pandabair'),
      ]);
      const league = await makeLeague(2023, 'Dragon');
      await makeTeam(dup.id, league.id, 5, 5, 'owner-a');
      await makeTeam(canon.id, league.id, 6, 4, 'owner-b');

      const plan = await planUserMerge(dup.id, canon.id);

      expect(plan.warnings.join(' ')).toMatch(/both own a team in 2023 Dragon/);
    });
  });
});
