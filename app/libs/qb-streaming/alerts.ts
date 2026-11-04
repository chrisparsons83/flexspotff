/** One QB as an admin alert lists them. */
export type AlertQb = {
  fullName: string;
  isDeep: boolean;
  /** e.g. "NYG vs DAL" or "NYG at DAL". */
  matchup: string;
};

const byName = (a: AlertQb, b: AlertQb) => a.fullName.localeCompare(b.fullName);

const pool = (qb: AlertQb) => (qb.isDeep ? 'both pools' : 'standard only');

const list = (qbs: AlertQb[], withPool: boolean) =>
  [...qbs]
    .sort(byName)
    .map(
      qb => `${qb.fullName}, ${qb.matchup}${withPool ? `, ${pool(qb)}` : ''}`,
    );

/** Posted when the sync opens a week: every QB in it, by pool. */
export function weekOpenedAlert(week: number, qbs: AlertQb[]) {
  const deep = qbs.filter(qb => qb.isDeep);
  const standard = qbs.filter(qb => !qb.isDeep);

  return [
    `QB Streaming week ${week} is open with ${qbs.length} QBs.`,
    '',
    `**Both pools (${deep.length})**`,
    ...(deep.length ? list(deep, false) : ['None']),
    '',
    `**Standard only (${standard.length})**`,
    ...(standard.length ? list(standard, false) : ['None']),
  ].join('\n');
}

/**
 * Posted when a refresh changes the week, or null when it didn't, so a quiet
 * run posts nothing.
 */
export function weekChangedAlert(
  week: number,
  changes: { added: AlertQb[]; restored: AlertQb[]; removed: AlertQb[] },
) {
  const { added, restored, removed } = changes;
  if (!added.length && !restored.length && !removed.length) return null;

  const sections: string[][] = [];
  if (added.length) sections.push(['**Added**', ...list(added, true)]);
  if (restored.length) {
    sections.push(['**Added back**', ...list(restored, true)]);
  }
  if (removed.length) {
    sections.push(['**Removed, projected at 0**', ...list(removed, true)]);
  }

  return [
    `QB Streaming week ${week} has changed.`,
    ...sections.flatMap(section => ['', ...section]),
  ].join('\n');
}
