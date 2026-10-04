/**
 * `monitor-scores` starts every 5 minutes, so a scheduler that is alive starts
 * some job at least that often. Three missed beats means the process is gone -
 * the failure that once stopped live scoring for days while the site looked
 * perfectly healthy.
 */
export const SCHEDULER_STALE_AFTER_MS = 15 * 60 * 1000;

/**
 * Whether the scheduler looks dead: no job has started recently. `null` when no
 * job has ever recorded a run, which says nothing either way (e.g. right after
 * the table was added).
 */
export function isSchedulerStale(
  lastStartedAts: (Date | string | null)[],
  now: Date,
): boolean | null {
  const latest = Math.max(
    ...lastStartedAts.map(at => (at ? new Date(at).getTime() : -Infinity)),
  );
  if (!Number.isFinite(latest)) return null;
  return now.getTime() - latest > SCHEDULER_STALE_AFTER_MS;
}

/** "just now", "12 min ago", "3 h ago", "2 d ago". */
export function timeAgo(at: Date | string, now: Date): string {
  const minutes = Math.floor((now.getTime() - new Date(at).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
