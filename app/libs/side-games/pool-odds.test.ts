import { fetchSpreadLines, fetchSpreadLinesResult } from './pool-odds.server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const games = [
  { gameStartTime: new Date('2026-11-29T18:00:00Z') },
  { gameStartTime: new Date('2026-11-30T01:15:00Z') },
];

const realSpreadsApiKey = process.env.SPREADS_API_KEY;
const realFetch = globalThis.fetch;

function oddsResponse(
  outcomes: { name: string; price: number; point?: number }[],
) {
  return [
    {
      id: 'odds-1',
      sport_key: 'americanfootball_nfl',
      sport_title: 'NFL',
      commence_time: '2026-11-29T18:00:00Z',
      home_team: 'Kansas City Chiefs',
      away_team: 'Buffalo Bills',
      bookmakers: [
        {
          key: 'draftkings',
          title: 'DraftKings',
          last_update: '2026-11-24T13:00:00Z',
          markets: [{ key: 'spreads', outcomes }],
        },
      ],
    },
  ];
}

describe('pool odds', () => {
  beforeEach(() => {
    process.env.SPREADS_API_KEY = 'test-key';
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    if (realSpreadsApiKey === undefined) delete process.env.SPREADS_API_KEY;
    else process.env.SPREADS_API_KEY = realSpreadsApiKey;
  });

  it('names the status and the API message when the response is not OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => JSON.stringify({ message: 'Invalid API key' }),
      })),
    );

    await expect(fetchSpreadLines(games)).rejects.toThrow(
      'The Odds API returned 401: Invalid API key',
    );
  });

  it('reports the non-OK response as a concrete automation failure reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () =>
          JSON.stringify({ message: 'Invalid commenceTimeFrom' }),
      })),
    );

    await expect(fetchSpreadLinesResult(games)).resolves.toEqual({
      ok: false,
      reason: {
        kind: 'api-error',
        message: 'The Odds API returned 422: Invalid commenceTimeFrom',
      },
    });
  });

  it('does not record an outcome without a point as a zero line', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () =>
          oddsResponse([
            { name: 'Kansas City Chiefs', price: -110 },
            { name: 'Buffalo Bills', price: -110, point: 3.5 },
          ]),
      })),
    );

    const lines = await fetchSpreadLines(games);

    expect(lines.has('Kansas City Chiefs')).toBe(false);
    expect(lines.get('Buffalo Bills')).toBe(3.5);
    expect(lines.size).toBe(1);
  });
});
