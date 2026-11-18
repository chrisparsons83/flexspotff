import { action } from './admin.spread-pool.$year.$week';
import type { ActionFunctionArgs } from '@remix-run/node';
import { deserializeRemix } from 'remix-typedjson';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as nflGameModel from '~/models/nflgame.server';
import * as poolGameModel from '~/models/poolgame.server';
import * as poolWeekModel from '~/models/poolweek.server';
import * as seasonModel from '~/models/season.server';
import * as auth from '~/services/auth.server';

vi.mock('~/services/auth.server', () => ({
  authenticator: {
    isAuthenticated: vi.fn(),
  },
  requireAdmin: vi.fn(),
}));
vi.mock('~/models/nflgame.server');
vi.mock('~/models/poolgame.server');
vi.mock('~/models/poolweek.server');
vi.mock('~/models/season.server');
vi.mock('~/db.server', () => ({
  prisma: {},
}));

const mockAdmin = { id: 'user-admin', discordName: 'Admin' };

const mockGames = [
  {
    id: 'game-1',
    gameStartTime: new Date('2025-09-07T17:00:00Z'),
    homeTeam: { name: 'Kansas City Chiefs' },
    awayTeam: { name: 'Buffalo Bills' },
  },
  {
    id: 'game-2',
    gameStartTime: new Date('2025-09-08T00:15:00Z'),
    homeTeam: { name: 'San Francisco 49ers' },
    awayTeam: { name: 'Seattle Seahawks' },
  },
];

const oddsResponse = [
  {
    id: 'odds-1',
    sport_key: 'americanfootball_nfl',
    sport_title: 'NFL',
    commence_time: '2025-09-07T17:00:00Z',
    home_team: 'Kansas City Chiefs',
    away_team: 'Buffalo Bills',
    bookmakers: [
      {
        key: 'draftkings',
        title: 'DraftKings',
        last_update: '2025-09-01T00:00:00Z',
        markets: [
          {
            key: 'spreads',
            outcomes: [
              { name: 'Kansas City Chiefs', price: -110, point: -3.5 },
              { name: 'Buffalo Bills', price: -110, point: 3.5 },
            ],
          },
        ],
      },
    ],
  },
];

const realFetch = globalThis.fetch;
const realSpreadsApiKey = process.env.SPREADS_API_KEY;

const mockWeek = {
  id: 'pool-week-3',
  createdAt: new Date('2025-09-01'),
  updatedAt: new Date('2025-09-01'),
  year: 2025,
  weekNumber: 3,
  isOpen: false,
  isWeekScored: false,
  autoManaged: true,
  openAlertedAt: null,
};

const postForm = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);

  return action({
    request: new Request('http://test/admin/spread-pool/2025/3', {
      method: 'POST',
      body,
    }),
    params: { year: '2025', week: '3' },
    context: {},
  } as ActionFunctionArgs);
};

describe('admin.spread-pool.$year.$week action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.authenticator.isAuthenticated).mockResolvedValue(
      mockAdmin as never,
    );
    vi.mocked(auth.requireAdmin).mockReturnValue(true);
    vi.mocked(seasonModel.getCurrentSeason).mockResolvedValue({
      year: 2025,
    } as never);
    vi.mocked(poolWeekModel.getPoolWeekByYearAndWeek).mockResolvedValue(
      mockWeek,
    );
    vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue([]);
    vi.mocked(poolGameModel.getPoolGamesByYearAndWeek).mockResolvedValue([]);
    process.env.SPREADS_API_KEY = 'test-key';
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => oddsResponse,
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    if (realSpreadsApiKey === undefined) delete process.env.SPREADS_API_KEY;
    else process.env.SPREADS_API_KEY = realSpreadsApiKey;
    globalThis.fetch = realFetch;
  });

  it('takes the week from the automation when an admin opens it', async () => {
    await postForm({
      _action: 'updateSpreads',
      isOpen: 'on',
      'homeSpread[game-1]': '-3.5',
    });

    expect(poolWeekModel.updatePoolWeek).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pool-week-3',
        isOpen: true,
        autoManaged: false,
      }),
    );
  });

  it('fills the page with the shared odds fetch keyed by team name', async () => {
    vi.mocked(nflGameModel.getWeekNflGames).mockResolvedValue(
      mockGames as never,
    );

    const response = await postForm({ _action: 'getSpreads' });
    const data = deserializeRemix(await response.json());

    expect(data.message).toBe('Game spreads have been populated.');
    expect(data.updatedNflGames.get('Kansas City Chiefs')).toBe(-3.5);
    expect(data.updatedNflGames.get('Buffalo Bills')).toBe(3.5);
  });

  it('still throws the missing API key message the page has always shown', async () => {
    delete process.env.SPREADS_API_KEY;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(postForm({ _action: 'getSpreads' })).rejects.toThrow(
      'SPREADS_API_KEY is missing.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
