import { DateTime } from 'luxon';

/**
 * Turns a guillotine league's stored rows into what its pages show. Kept free
 * of Prisma and React so the maths can be tested directly.
 */

export type ViewTeam = {
  rosterId: number;
  choppedWeek: number | null;
  finish: number | null;
};

export type ViewWeekScore = {
  rosterId: number;
  week: number;
  points: number;
  players: string[];
};

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The lowest score among the teams alive in a week - the chop line. A week
 * with nobody scoring yet has no line.
 */
export function cutLineForWeek(scores: ViewWeekScore[], week: number) {
  const points = scores.filter(s => s.week === week).map(s => s.points);
  if (points.length === 0 || points.every(p => p === 0)) return null;
  return Math.min(...points);
}

export type StandingRow = {
  rosterId: number;
  place: number | null;
  alive: boolean;
  choppedWeek: number | null;
  weeksSurvived: number;
  totalPoints: number;
  averagePoints: number | null;
  bestWeek: { week: number; points: number } | null;
  /** The smallest margin the team ever had above the chop line and survived. */
  closestEscape: { week: number; margin: number } | null;
};

/**
 * One row per team: where it finished and how it got there. Survivors sort
 * first, by points; everyone else by finishing place.
 */
export function buildStandings({
  teams,
  scores,
  lastScoredWeek,
}: {
  teams: ViewTeam[];
  scores: ViewWeekScore[];
  lastScoredWeek: number;
}): StandingRow[] {
  const cutByWeek = new Map<number, number | null>();
  for (let week = 1; week <= lastScoredWeek; week++) {
    cutByWeek.set(week, cutLineForWeek(scores, week));
  }

  const rows = teams.map(team => {
    // Only finished weeks count towards averages and escapes - the week in
    // progress is still moving.
    const played = scores.filter(
      s => s.rosterId === team.rosterId && s.week <= lastScoredWeek,
    );
    const totalPoints = round(played.reduce((sum, s) => sum + s.points, 0));
    const best = played.reduce<ViewWeekScore | null>(
      (top, s) => (!top || s.points > top.points ? s : top),
      null,
    );

    let closestEscape: StandingRow['closestEscape'] = null;
    for (const s of played) {
      if (s.week === team.choppedWeek) continue;
      const cut = cutByWeek.get(s.week);
      if (cut === null || cut === undefined) continue;
      const margin = round(s.points - cut);
      if (margin <= 0) continue;
      if (!closestEscape || margin < closestEscape.margin) {
        closestEscape = { week: s.week, margin };
      }
    }

    return {
      rosterId: team.rosterId,
      place: team.finish,
      alive: team.choppedWeek === null && team.finish !== 1,
      choppedWeek: team.choppedWeek,
      weeksSurvived:
        team.choppedWeek !== null ? team.choppedWeek - 1 : lastScoredWeek,
      totalPoints,
      averagePoints: played.length ? round(totalPoints / played.length) : null,
      bestWeek: best ? { week: best.week, points: best.points } : null,
      closestEscape,
    };
  });

  return rows.sort((a, b) => {
    if (a.place === 1) return -1;
    if (b.place === 1) return 1;
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    if (a.alive && b.alive) return b.totalPoints - a.totalPoints;
    return (a.place ?? 99) - (b.place ?? 99);
  });
}

export type GridCell = {
  points: number;
  /** Where the score ranked among the teams alive that week, 1 is highest. */
  rank: number;
  /** Points above the chop line; 0 for the lowest score. */
  margin: number | null;
  chopped: boolean;
};

/**
 * The chop tracker: roster -> week -> that week's cell, for the weeks a team
 * was alive. A missing cell means the team was already gone.
 */
export function buildChopGrid({
  teams,
  scores,
  throughWeek,
}: {
  teams: ViewTeam[];
  scores: ViewWeekScore[];
  throughWeek: number;
}): Map<number, Map<number, GridCell>> {
  const grid = new Map<number, Map<number, GridCell>>(
    teams.map(team => [team.rosterId, new Map()]),
  );
  const choppedIn = new Map(teams.map(t => [t.rosterId, t.choppedWeek]));

  for (let week = 1; week <= throughWeek; week++) {
    const weekScores = scores
      .filter(s => s.week === week)
      .sort((a, b) => b.points - a.points);
    const cut = cutLineForWeek(scores, week);

    weekScores.forEach((score, index) => {
      grid.get(score.rosterId)?.set(week, {
        points: score.points,
        rank: index + 1,
        margin: cut === null ? null : round(score.points - cut),
        chopped: choppedIn.get(score.rosterId) === week,
      });
    });
  }

  return grid;
}

export type ViewTransaction = {
  sleeperTransactionId: string;
  type: string;
  status: string;
  leg: number;
  rosterIds: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  bid: number | null;
  notes: string | null;
  processedAt: Date;
};

export type WaiverBid = { rosterId: number; bid: number; notes: string | null };

export type WaiverClaim = {
  sleeperId: string;
  winner: WaiverBid | null;
  /** Every bid that lost, highest first. */
  losingBids: WaiverBid[];
  /** The chopped team this player was released by, if any. */
  releasedBy: { rosterId: number; week: number } | null;
};

export type WaiverRun = {
  /** The football week the claims are for. */
  week: number;
  claims: WaiverClaim[];
};

/**
 * The football week a guillotine waiver claim is for.
 *
 * Guillotine waivers do not run on the main leagues' schedule. Checked against
 * every batch of the 2021, 2025 and 2026 leagues:
 *
 * - The weekly run lands on Thursday between 00:00 and 00:06 Pacific, the
 *   night after Wednesday, and Sleeper files it under the leg of the week that
 *   just ended. Its claims are for the next week: `leg + 1`.
 * - Any other batch is a rolling clear later in the week (Thursday night to
 *   Sunday morning), after Sleeper has moved on to the new leg. Its claims are
 *   for that same week: `leg`.
 */
export function waiverClaimWeek(leg: number, processedAt: Date): number {
  const pacific = DateTime.fromJSDate(processedAt).setZone(
    'America/Los_Angeles',
  );
  const isWeeklyRun = pacific.weekday === 4 && pacific.hour < 3;
  return isWeeklyRun ? leg + 1 : leg;
}

/**
 * Every waiver run in a league, newest first, with each player's bids gathered
 * together and the chopped team they came from. See `waiverClaimWeek` for how
 * a batch is matched to the week its claims are for.
 */
export function buildWaiverRuns({
  transactions,
  teams,
  scores,
}: {
  transactions: ViewTransaction[];
  teams: ViewTeam[];
  scores: ViewWeekScore[];
}): WaiverRun[] {
  // Who released whom: a chopped team's roster in its chop week. A player can
  // be released more than once a season - claimed off one chopped team, then
  // chopped again with the next - so every release is kept, oldest first.
  const releases = new Map<string, { rosterId: number; week: number }[]>();
  for (const team of [...teams].sort(
    (a, b) => (a.choppedWeek ?? 0) - (b.choppedWeek ?? 0),
  )) {
    if (team.choppedWeek === null) continue;
    const chopWeek = scores.find(
      s => s.rosterId === team.rosterId && s.week === team.choppedWeek,
    );
    for (const sleeperId of chopWeek?.players ?? []) {
      const list = releases.get(sleeperId) ?? [];
      list.push({ rosterId: team.rosterId, week: team.choppedWeek });
      releases.set(sleeperId, list);
    }
  }

  const byWeek = new Map<number, Map<string, WaiverClaim>>();
  for (const t of transactions) {
    if (t.type !== 'waiver' || !t.adds) continue;
    const week = waiverClaimWeek(t.leg, t.processedAt);
    const claims = byWeek.get(week) ?? new Map<string, WaiverClaim>();
    byWeek.set(week, claims);

    for (const [sleeperId, rosterId] of Object.entries(t.adds)) {
      const claim = claims.get(sleeperId) ?? {
        sleeperId,
        winner: null,
        losingBids: [],
        releasedBy: null,
      };
      // The latest chop before the week this claim is for is where the player
      // came from. A chop in that week or later happened after the claim.
      const release = (releases.get(sleeperId) ?? [])
        .filter(r => r.week < week)
        .at(-1);
      if (release) claim.releasedBy = release;

      const bid = { rosterId, bid: t.bid ?? 0, notes: t.notes };
      if (t.status === 'complete') claim.winner = bid;
      else claim.losingBids.push(bid);
      claims.set(sleeperId, claim);
    }
  }

  return [...byWeek.entries()]
    .sort(([a], [b]) => b - a)
    .map(([week, claims]) => ({
      week,
      claims: [...claims.values()]
        .map(claim => ({
          ...claim,
          losingBids: claim.losingBids.sort((a, b) => b.bid - a.bid),
        }))
        .sort(
          (a, b) =>
            (b.winner?.bid ?? -1) - (a.winner?.bid ?? -1) ||
            b.losingBids.length - a.losingBids.length,
        ),
    }));
}
