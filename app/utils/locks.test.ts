import { getLocksWeekCutoff, isLocksWeekLocked } from './locks';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';

const et = (isoWithoutZone: string) =>
  DateTime.fromISO(isoWithoutZone, { zone: 'America/New_York' }).toJSDate();

const games = (...starts: string[]) =>
  starts.map(start => ({ gameStartTime: et(start) }));

describe('getLocksWeekCutoff', () => {
  it('returns the Sunday 1PM ET of a normal Thursday-opening week', () => {
    // 2025 week 2
    const cutoff = getLocksWeekCutoff(
      games('2025-09-11T20:15', '2025-09-14T13:00', '2025-09-15T22:00'),
    );
    expect(cutoff).toEqual(et('2025-09-14T13:00'));
  });

  it('handles a week that opens on Wednesday', () => {
    // 2026 week 1 opens Wednesday, 2024 week 17 opened on Christmas Wednesday
    expect(
      getLocksWeekCutoff(games('2026-09-09T20:20', '2026-09-14T20:15')),
    ).toEqual(et('2026-09-13T13:00'));
    expect(
      getLocksWeekCutoff(games('2024-12-25T13:00', '2024-12-30T20:15')),
    ).toEqual(et('2024-12-29T13:00'));
  });

  it('handles a Saturday-opening week 18', () => {
    // 2024 week 18
    expect(
      getLocksWeekCutoff(games('2025-01-04T16:30', '2025-01-05T20:20')),
    ).toEqual(et('2025-01-05T13:00'));
  });

  it('uses the same day when the week opens on a Sunday morning', () => {
    // 2023 week 18 was Sunday-only
    expect(
      getLocksWeekCutoff(games('2024-01-07T16:30', '2024-01-07T16:30')),
    ).toEqual(et('2024-01-07T13:00'));
  });

  it('does not depend on the order games are passed in', () => {
    expect(
      getLocksWeekCutoff(games('2025-09-15T22:00', '2025-09-11T20:15')),
    ).toEqual(et('2025-09-14T13:00'));
  });

  it('returns null when the week has no games', () => {
    expect(getLocksWeekCutoff([])).toBeNull();
  });
});

describe('isLocksWeekLocked', () => {
  const cutoff = getLocksWeekCutoff(
    games('2026-09-09T20:20', '2026-09-14T20:15'),
  );

  it('is unlocked right up to 1PM ET Sunday', () => {
    expect(isLocksWeekLocked(cutoff, et('2026-09-13T12:59'))).toBe(false);
  });

  it('locks at 1PM ET Sunday and stays locked through Monday night', () => {
    expect(isLocksWeekLocked(cutoff, et('2026-09-13T13:00'))).toBe(true);
    expect(isLocksWeekLocked(cutoff, et('2026-09-14T20:14'))).toBe(true);
    expect(isLocksWeekLocked(cutoff, et('2026-09-20T13:00'))).toBe(true);
  });

  it('does not lock the next week just because it is Monday', () => {
    // The regression this replaced: a Monday "now" disabled every field on the
    // upcoming week's entry form.
    const week2Cutoff = getLocksWeekCutoff(
      games('2026-09-17T20:15', '2026-09-21T20:15'),
    );
    expect(isLocksWeekLocked(week2Cutoff, et('2026-09-14T12:00'))).toBe(false);
    expect(isLocksWeekLocked(week2Cutoff, et('2026-09-14T20:15'))).toBe(false);
  });

  it('never locks a week with no games', () => {
    expect(isLocksWeekLocked(null, et('2026-09-13T13:00'))).toBe(false);
  });
});
