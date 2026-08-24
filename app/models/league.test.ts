import { updateLeague } from './league.server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '~/db.server';

vi.mock('~/db.server', () => ({
  prisma: {
    league: {
      update: vi.fn(),
    },
  },
}));

const updatePayload = () => {
  const [call] = vi.mocked(prisma.league.update).mock.calls;
  return call[0] as { where: { id: string }; data: Record<string, unknown> };
};

describe('updateLeague', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.league.update).mockResolvedValue({} as never);
  });

  it('writes the named fields and keys the update off the id', async () => {
    const draftDateTime = new Date('2024-09-03T21:00:00.000Z');

    await updateLeague({ id: 'league-1', draftDateTime });

    const { where, data } = updatePayload();
    expect(where).toEqual({ id: 'league-1' });
    expect(data.draftDateTime).toEqual(draftDateTime);
  });

  // jobs/sync-leagues.ts hands syncMultipleLeagues the rows from
  // getLeaguesByYear, which are read with `include: { teams }`. Forwarding the
  // caller's object straight to Prisma puts that teams array in the update
  // payload, which Prisma rejects - taking the whole scheduled sync down with
  // it. Read-only columns have to be dropped for the same reason.
  it('drops relations and read-only columns a caller passes in', async () => {
    const leagueRowWithTeams = {
      id: 'league-1',
      name: 'Champions',
      year: 2024,
      sleeperLeagueId: 'sleeper-league-1',
      sleeperDraftId: 'sleeper-draft-1',
      draftDateTime: null,
      tier: 1,
      isActive: true,
      isDrafted: false,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      teams: [{ id: 'team-1' }],
    };

    await updateLeague(leagueRowWithTeams);

    const { where, data } = updatePayload();
    expect(where).toEqual({ id: 'league-1' });
    expect(data).not.toHaveProperty('teams');
    expect(data).not.toHaveProperty('createdAt');
    expect(data).not.toHaveProperty('updatedAt');
    expect(data).not.toHaveProperty('id');
    // The scalars the caller did name still go through.
    expect(data.name).toBe('Champions');
    expect(data.isDrafted).toBe(false);
  });
});
