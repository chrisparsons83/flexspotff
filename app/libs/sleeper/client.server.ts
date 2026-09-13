import type { z } from 'zod';

const SLEEPER_API_BASE = 'https://api.sleeper.app';

/** Sleeper occasionally 502s or rate-limits mid-sync; one retry clears it. */
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class SleeperApiError extends Error {
  constructor(readonly status: number, readonly path: string) {
    super(`Sleeper API error ${status}: GET ${path}`);
    this.name = 'SleeperApiError';
  }
}

/**
 * The one way to read from Sleeper.
 *
 * Callers used to hand-roll this, and inconsistently: some checked `res.ok` and
 * some (`syncAdp`, `getNflState`) went straight to `.json()`, so an outage came
 * back as an inscrutable Zod error about the HTML error page instead of a
 * status code.
 *
 * @param path - API path beginning with a slash, e.g. `/v1/state/nfl`
 * @param schema - Zod schema the response body must satisfy
 * @param baseUrl - override for the handful of endpoints on api.sleeper.com
 */
export async function sleeperFetch<T extends z.ZodTypeAny>(
  path: string,
  schema: T,
  baseUrl: string = SLEEPER_API_BASE,
): Promise<z.infer<T>> {
  let lastStatus = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);

    const res = await fetch(`${baseUrl}${path}`);
    if (res.ok) {
      return schema.parse(await res.json());
    }

    lastStatus = res.status;
    if (!RETRY_STATUSES.has(res.status)) break;
  }

  throw new SleeperApiError(lastStatus, path);
}
