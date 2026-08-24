import { syncAdp } from './syncs.server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as draftPickModel from '~/models/draftpick.server';
import type { League } from '~/models/league.server';
import * as leagueModel from '~/models/league.server';
import * as playerModel from '~/models/players.server';
import * as teamModel from '~/models/team.server';

vi.mock('~/models/draftpick.server');
vi.mock('~/models/league.server');
vi.mock('~/models/players.server');
vi.mock('~/models/team.server');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

describe('syncAdp', () => {
  const realFetch = globalThis.fetch;

  const league = {
    id: 'league-1',
    name: 'Champions',
    year: 2024,
    sleeperLeagueId: 'sleeper-league-1',
    sleeperDraftId: 'sleeper-draft-1',
    isDrafted: false,
    isActive: true,
    tier: 1,
    draftDateTime: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  } as League;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(draftPickModel.getDraftPicks).mockResolvedValue(null as never);
    vi.mocked(playerModel.getPlayers).mockResolvedValue([] as never);
    vi.mocked(teamModel.getTeams).mockResolvedValue([] as never);
    vi.mocked(leagueModel.updateLeague).mockResolvedValue({} as never);

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => [],
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  // syncLeague writes the draft date it pulled from Sleeper and then calls
  // syncAdp with the league object it was handed, which still holds the old
  // date. Writing the whole object back here used to undo that write, so an
  // undrafted league never picked up its draft time.
  it('only writes isDrafted, leaving the rest of the league row alone', async () => {
    await syncAdp(league);

    expect(leagueModel.updateLeague).toHaveBeenCalledWith({
      id: 'league-1',
      isDrafted: false,
    });
  });
});
