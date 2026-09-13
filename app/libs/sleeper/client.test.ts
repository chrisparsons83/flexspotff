import { SleeperApiError, sleeperFetch } from './client.server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import z from 'zod';

describe('sleeperFetch', () => {
  const realFetch = globalThis.fetch;
  const mockFetch = vi.fn();
  const schema = z.object({ week: z.number() });

  beforeEach(() => {
    mockFetch.mockReset();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const respond = (body: unknown, ok = true, status = 200) =>
    ({ ok, status, json: async () => body } as Response);

  it('parses a successful response against the schema', async () => {
    mockFetch.mockResolvedValue(respond({ week: 3 }));

    await expect(sleeperFetch('/v1/state/nfl', schema)).resolves.toEqual({
      week: 3,
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.sleeper.app/v1/state/nfl',
    );
  });

  // Sleeper rate-limits and 502s mid-sync often enough that a single failed
  // request used to abort a whole week of scores.
  it('retries once on a retryable status and returns the retry', async () => {
    mockFetch
      .mockResolvedValueOnce(respond(null, false, 502))
      .mockResolvedValueOnce(respond({ week: 3 }));

    await expect(sleeperFetch('/v1/state/nfl', schema)).resolves.toEqual({
      week: 3,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('gives up after one retry and reports the status and path', async () => {
    mockFetch.mockResolvedValue(respond(null, false, 500));

    await expect(sleeperFetch('/v1/state/nfl', schema)).rejects.toThrow(
      new SleeperApiError(500, '/v1/state/nfl'),
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // A 404 means the ID is wrong, so retrying just doubles the wait.
  it('does not retry a status that will not change', async () => {
    mockFetch.mockResolvedValue(respond(null, false, 404));

    await expect(sleeperFetch('/v1/league/nope', schema)).rejects.toThrow(
      'Sleeper API error 404: GET /v1/league/nope',
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('honours a base URL override', async () => {
    mockFetch.mockResolvedValue(respond({ week: 1 }));

    await sleeperFetch('/players/nfl', schema, 'https://api.sleeper.com');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.sleeper.com/players/nfl',
    );
  });
});
