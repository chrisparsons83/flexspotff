/**
 * A member's week on the dashboard: one row per thing they are in this
 * season, in the nav's order, each saying how last week went and what this
 * week needs. Anything they still have to do comes first.
 *
 * Built from facts the server has already gathered, so the rules can be
 * tested without a database.
 */

export type DashboardSection = 'Leagues' | 'Side leagues' | 'Games';

export type DashboardRow = {
  section: DashboardSection;
  label: string;
  lastWeek: string | null;
  thisWeek: string | null;
  /** Something the member still has to do this week. */
  todo: boolean;
  /** When picks for this week lock, where the data says. */
  deadline: Date | null;
  href: string;
};

/** A weekly pick'em game's week, as the member stands in it. */
export type PickWeek = {
  id: string;
  week: number;
  isOpen: boolean;
  isScored: boolean;
  /** How many picks the member has in. */
  picks: number;
  /** The week's first kickoff, which is when the first picks lock. */
  firstKickoff: Date | null;
};

export type MemberWeekFacts = {
  year: number;
  league: {
    name: string;
    lastWeek: {
      week: number;
      points: number;
      opponentPoints: number;
      opponent: string;
    } | null;
    thisWeek: { week: number; opponent: string } | null;
  } | null;
  guillotine: {
    leagueId: string;
    name: string;
    choppedWeek: number | null;
    finish: number | null;
  }[];
  qbStreaming: PickWeek | null;
  spreadPool: PickWeek | null;
  locks: PickWeek | null;
  dfsSurvivor: {
    week: number;
    entries: number;
    isLocked: boolean;
    lastScored: { week: number; points: number } | null;
  } | null;
  survivor: { poolId: string; name: string; alive: boolean }[];
  fSquared: { isOpen: boolean; hasEntry: boolean };
  registration: { isOpen: boolean; isRegistered: boolean };
};

const ORDER: DashboardSection[] = ['Leagues', 'Side leagues', 'Games'];

const result = (points: number, opponentPoints: number) =>
  points > opponentPoints ? 'Won' : points < opponentPoints ? 'Lost' : 'Tied';

/** A pick'em game's row, or none when it has no week this season. */
function pickRow(
  label: string,
  href: string,
  week: PickWeek | null,
  noun: string,
): DashboardRow | null {
  if (!week) return null;
  const open = week.isOpen && !week.isScored;
  return {
    section: 'Games',
    label,
    lastWeek: null,
    thisWeek: week.isScored
      ? `Week ${week.week} scored`
      : open
      ? week.picks > 0
        ? `Week ${week.week}: ${week.picks} ${noun}${
            week.picks === 1 ? '' : 's'
          } in`
        : `Week ${week.week}: no ${noun}s yet`
      : `Week ${week.week} not open yet`,
    todo: open && week.picks === 0,
    deadline: open ? week.firstKickoff : null,
    href: open ? `${href}/entries/${week.id}` : href,
  };
}

export function buildMemberWeek(facts: MemberWeekFacts): DashboardRow[] {
  const rows: (DashboardRow | null)[] = [];

  if (facts.league) {
    const { lastWeek, thisWeek, name } = facts.league;
    rows.push({
      section: 'Leagues',
      label: name,
      lastWeek: lastWeek
        ? `${result(
            lastWeek.points,
            lastWeek.opponentPoints,
          )} ${lastWeek.points.toFixed(2)} to ${lastWeek.opponentPoints.toFixed(
            2,
          )} against ${lastWeek.opponent}`
        : null,
      thisWeek: thisWeek
        ? `Week ${thisWeek.week} against ${thisWeek.opponent}`
        : null,
      todo: false,
      deadline: null,
      href: `/leagues/${facts.year}/${name.toLowerCase()}/matchups`,
    });
  }

  for (const team of facts.guillotine) {
    rows.push({
      section: 'Side leagues',
      label: team.name,
      lastWeek: null,
      thisWeek:
        team.finish === 1
          ? 'Champion'
          : team.choppedWeek
          ? `Chopped in week ${team.choppedWeek}`
          : 'Still alive',
      todo: false,
      deadline: null,
      href: `/side-leagues/guillotine/${team.leagueId}`,
    });
  }

  rows.push(
    pickRow('QB streaming', '/games/qb-streaming', facts.qbStreaming, 'pick'),
    pickRow('Spread pool', '/games/spread-pool', facts.spreadPool, 'bet'),
    pickRow('Locks challenge', '/games/locks-challenge', facts.locks, 'pick'),
  );

  if (facts.dfsSurvivor) {
    const dfs = facts.dfsSurvivor;
    rows.push({
      section: 'Games',
      label: 'DFS survivor',
      lastWeek: dfs.lastScored
        ? `${dfs.lastScored.points.toFixed(2)} points in week ${
            dfs.lastScored.week
          }`
        : null,
      thisWeek: dfs.isLocked
        ? `Week ${dfs.week} locked`
        : dfs.entries > 0
        ? `Week ${dfs.week}: ${dfs.entries} of 11 players in`
        : `Week ${dfs.week}: no lineup yet`,
      todo: !dfs.isLocked && dfs.entries === 0,
      deadline: null,
      href: '/games/dfs-survivor/entries',
    });
  }

  for (const entry of facts.survivor) {
    rows.push({
      section: 'Games',
      label: entry.name,
      lastWeek: null,
      thisWeek: entry.alive ? 'Still alive' : 'Out',
      todo: false,
      deadline: null,
      href: `/games/survivor/${entry.poolId}`,
    });
  }

  if (facts.fSquared.isOpen) {
    rows.push({
      section: 'Games',
      label: 'F²',
      lastWeek: null,
      thisWeek: facts.fSquared.hasEntry ? 'Entry in' : 'No entry yet',
      todo: !facts.fSquared.hasEntry,
      deadline: null,
      href: '/games/f-squared/entries',
    });
  }

  if (facts.registration.isOpen) {
    rows.push({
      section: 'Leagues',
      label: `${facts.year} registration`,
      lastWeek: null,
      thisWeek: facts.registration.isRegistered
        ? 'Registered'
        : 'Not registered yet',
      todo: !facts.registration.isRegistered,
      deadline: null,
      href: '/dashboard/registration',
    });
  }

  return rows
    .filter((row): row is DashboardRow => row !== null)
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        Number(b.row.todo) - Number(a.row.todo) ||
        ORDER.indexOf(a.row.section) - ORDER.indexOf(b.row.section) ||
        a.index - b.index,
    )
    .map(({ row }) => row);
}
