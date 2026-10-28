import { relativeTime } from './RelativeTime';

const now = Date.parse('2026-10-27T12:00:00Z');
const at = (ms: number) => new Date(now + ms);

describe('relativeTime', () => {
  it('counts minutes inside the hour', () => {
    expect(relativeTime(at(40 * 60_000), now)).toBe('in 40 minutes');
  });

  it('counts hours inside the day', () => {
    expect(relativeTime(at(5 * 3_600_000), now)).toBe('in 5 hours');
  });

  it('says tomorrow for a day out', () => {
    expect(relativeTime(at(26 * 3_600_000), now)).toBe('tomorrow');
  });

  it('counts days inside the week', () => {
    expect(relativeTime(at(4 * 86_400_000), now)).toBe('in 4 days');
  });

  it('gives the date past a week', () => {
    expect(relativeTime(at(12 * 86_400_000), now)).toBe('Nov 8');
  });

  it('reads a time that has passed', () => {
    expect(relativeTime(at(-2 * 3_600_000), now)).toBe('2 hours ago');
  });
});
