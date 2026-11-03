import {
  getSleeperCallsPastWeek,
  recordSleeperCalls,
} from './scheduledJobRun.server';
import { beforeEach, describe, expect, it } from 'vitest';
import { truncateDB } from '~/utils/vitest';

const at = (iso: string) => new Date(iso);

describe('Sleeper calls past week', () => {
  beforeEach(async () => {
    await truncateDB();
  });

  it('adds up every run of a job within the week', async () => {
    await recordSleeperCalls('sync-leagues', 3, at('2026-11-02T01:00:00Z'));
    await recordSleeperCalls('sync-leagues', 4, at('2026-11-02T23:00:00Z'));
    await recordSleeperCalls('sync-leagues', 5, at('2026-10-30T12:00:00Z'));

    expect(await getSleeperCallsPastWeek(at('2026-11-02T23:30:00Z'))).toEqual({
      'sync-leagues': 12,
    });
  });

  it('keeps each job separate', async () => {
    await recordSleeperCalls('sync-leagues', 3, at('2026-11-02T01:00:00Z'));
    await recordSleeperCalls('monitor-scores', 2, at('2026-11-02T01:00:00Z'));

    expect(await getSleeperCallsPastWeek(at('2026-11-02T02:00:00Z'))).toEqual({
      'sync-leagues': 3,
      'monitor-scores': 2,
    });
  });

  // Today plus the six days before it: on 2 Nov that reaches back to 27 Oct,
  // so 26 Oct is out.
  it('leaves out days older than a week', async () => {
    await recordSleeperCalls('sync-leagues', 100, at('2026-10-26T12:00:00Z'));
    await recordSleeperCalls('sync-leagues', 10, at('2026-10-27T12:00:00Z'));
    await recordSleeperCalls('sync-leagues', 1, at('2026-11-02T12:00:00Z'));

    expect(await getSleeperCallsPastWeek(at('2026-11-02T12:00:00Z'))).toEqual({
      'sync-leagues': 11,
    });
  });
});
