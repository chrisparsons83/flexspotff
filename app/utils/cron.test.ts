import { cronToHuman } from './cron';
import { describe, expect, it } from 'vitest';
import { SCHEDULED_JOBS } from '~/utils/jobs';

describe('cronToHuman', () => {
  it('labels an unzoned schedule as UTC, which is what the container runs in', () => {
    expect(cronToHuman('0 5 * * 2')).toBe('Weekly on Tuesday at 5:00 AM UTC');
  });

  /**
   * The waiver report holds a wall-clock Pacific time across DST, so showing it
   * as UTC on the admin page would be an hour wrong for half the season.
   */
  it('labels a zoned schedule with its zone', () => {
    expect(cronToHuman('20,35,50 0 * * 3', 'America/Los_Angeles')).toBe(
      'Weekly on Wednesday at 12:20 AM, 12:35 AM, 12:50 AM PT',
    );
  });

  it('shows every run of a minute list, not just the first', () => {
    // The retry passes are the point of this job's schedule; hiding them made
    // the scheduler page misleading.
    const human = cronToHuman('20,35,50 0 * * 3', 'America/Los_Angeles');
    expect(human).toContain('12:35 AM');
    expect(human).toContain('12:50 AM');
  });

  it('falls back to the raw zone name when there is no short label', () => {
    expect(cronToHuman('0 6 * * 1', 'Europe/London')).toContain(
      'Europe/London',
    );
  });

  it('labels the common-pattern shortcuts too', () => {
    expect(cronToHuman('0 0 * * *')).toBe('Daily at 12:00 AM UTC');
    expect(cronToHuman('0 0 * * *', 'America/New_York')).toBe(
      'Daily at 12:00 AM ET',
    );
  });

  it('leaves a schedule with no time of day unlabelled', () => {
    expect(cronToHuman('*/5 * * * *')).not.toContain('UTC');
  });

  it('handles a missing schedule', () => {
    expect(cronToHuman(undefined)).toBe('No schedule');
  });

  it('renders every registered job without falling back to the raw cron', () => {
    for (const job of SCHEDULED_JOBS) {
      const human = cronToHuman(job.cron, job.timezone);
      expect(human).not.toBe(job.cron);
      expect(human).not.toBe('No schedule');
    }
  });
});
