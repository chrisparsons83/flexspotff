import { isSchedulerStale, timeAgo } from './scheduler-health';
import { describe, expect, it } from 'vitest';

const now = new Date('2026-10-04T18:00:00Z');
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60 * 1000);

describe('isSchedulerStale', () => {
  it('is fresh when any job started within the window', () => {
    expect(isSchedulerStale([minutesAgo(600), minutesAgo(4), null], now)).toBe(
      false,
    );
  });

  it('is stale when the most recent start is past the window', () => {
    expect(isSchedulerStale([minutesAgo(16), minutesAgo(60)], now)).toBe(true);
  });

  it('reads serialized dates from loader data', () => {
    expect(isSchedulerStale([minutesAgo(2).toISOString()], now)).toBe(false);
  });

  it('cannot tell when nothing has run yet', () => {
    expect(isSchedulerStale([], now)).toBeNull();
    expect(isSchedulerStale([null, null], now)).toBeNull();
  });
});

describe('timeAgo', () => {
  it('formats minutes, hours and days', () => {
    expect(timeAgo(minutesAgo(0), now)).toBe('just now');
    expect(timeAgo(minutesAgo(12), now)).toBe('12 min ago');
    expect(timeAgo(minutesAgo(180), now)).toBe('3 h ago');
    expect(timeAgo(minutesAgo(60 * 24 * 3), now)).toBe('3 d ago');
  });
});
