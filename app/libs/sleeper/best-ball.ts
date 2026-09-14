/**
 * Best-ball scoring, which Sleeper does not expose.
 *
 * A best-ball roster is scored on its optimal lineup, but the matchups endpoint
 * does not say so: `points` is the sum of the frozen `starters` array, which
 * Sleeper never reorders during the week. Its own UI shows the optimum, so the
 * two disagree by a lot mid-Sunday - a roster whose finished players are on the
 * bench and whose late-game starters are still on 0 reads far too low. The D12
 * leaderboard stored that number, so we compute the optimum here instead.
 */

/** Sleeper roster slot -> the positions allowed to fill it. */
export const SLOT_ELIGIBILITY: Record<string, string[]> = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  K: ['K'],
  DEF: ['DEF'],
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};

/** Slots that never score, so they take no player. */
const NON_SCORING_SLOTS = new Set(['BN', 'IR', 'TAXI']);

/** The empty-slot marker, matching what TeamGame.starters uses. */
const EMPTY_SLOT = '0';

export type BestBallLineup = {
  /** Sleeper player IDs in slot order, '0' for a slot nothing could fill. */
  starters: string[];
  /** Points per slot, correlated to `starters` by index. */
  startingPlayerPoints: number[];
  /** The optimal total, i.e. the sum of `startingPlayerPoints`. */
  points: number;
  /**
   * Sleeper IDs that scored above zero but have no position on record, so could
   * not be slotted. Non-empty means the total is an undercount, and callers
   * should say so rather than storing it quietly.
   */
  unplaceable: string[];
  /**
   * Scoring slots whose type we do not recognise, so nobody could be put in
   * them. Same failure mode as `unplaceable` - points left on the floor - so
   * callers should report it rather than storing the undercount quietly.
   */
  unknownSlots: string[];
};

/**
 * The highest-scoring legal lineup for one roster in one week.
 *
 * Fills the most restrictive slot first, taking the best unused eligible player
 * each time. That is exact while the eligibility sets are nested, which is every
 * slot D12 uses: RB, WR and TE are each a subset of FLEX, and QB shares with
 * nothing. WRRB_FLEX (RB, WR) and REC_FLEX (WR, TE) are the one pair that
 * crosses rather than nests, and a lineup using both could in principle want a
 * swap greedy will not make; no D12 league has either slot.
 */
export function bestBallLineup({
  rosterPositions,
  playersPoints,
  positionBySleeperId,
}: {
  /** `roster_positions` from the league info endpoint. */
  rosterPositions: string[];
  /** `players_points` from the matchup, covering the whole roster. */
  playersPoints: Record<string, number | null>;
  /** Sleeper player ID -> position, from our own player table. */
  positionBySleeperId: Map<string, string | null>;
}): BestBallLineup {
  // Slots keep their original order in the returned arrays, so a lineup reads
  // QB, RB, RB, WR, ... the way it does on Sleeper. Only the order we *fill*
  // them in is by restrictiveness.
  const slots = rosterPositions.filter(slot => !NON_SCORING_SLOTS.has(slot));

  const candidates: { sleeperId: string; position: string; points: number }[] =
    [];
  const unplaceable: string[] = [];
  for (const [sleeperId, rawPoints] of Object.entries(playersPoints)) {
    const points = rawPoints ?? 0;
    const position = positionBySleeperId.get(sleeperId);
    if (!position) {
      if (points > 0) unplaceable.push(sleeperId);
      continue;
    }
    candidates.push({ sleeperId, position, points });
  }

  const starters = slots.map(() => EMPTY_SLOT);
  const startingPlayerPoints = slots.map(() => 0);

  const fillOrder = slots
    .map((slot, slotIndex) => ({ slot, slotIndex }))
    .sort(
      (a, b) =>
        (SLOT_ELIGIBILITY[a.slot]?.length ?? Number.MAX_SAFE_INTEGER) -
        (SLOT_ELIGIBILITY[b.slot]?.length ?? Number.MAX_SAFE_INTEGER),
    );

  const unknownSlots = new Set<string>();
  const used = new Set<string>();
  for (const { slot, slotIndex } of fillOrder) {
    const eligible = SLOT_ELIGIBILITY[slot];
    // An unrecognised slot takes nobody rather than anybody, so a new Sleeper
    // slot type shows up as an empty slot instead of a wrong score - reported,
    // since the total is then an undercount.
    if (!eligible) {
      unknownSlots.add(slot);
      continue;
    }

    let best: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (used.has(candidate.sleeperId)) continue;
      if (!eligible.includes(candidate.position)) continue;
      if (!best || candidate.points > best.points) best = candidate;
    }
    if (!best) continue;

    used.add(best.sleeperId);
    starters[slotIndex] = best.sleeperId;
    startingPlayerPoints[slotIndex] = best.points;
  }

  // Sleeper reports points to two decimals; summing floats does not stay there.
  const points =
    Math.round(startingPlayerPoints.reduce((sum, p) => sum + p, 0) * 100) / 100;

  return {
    starters,
    startingPlayerPoints,
    points,
    unplaceable,
    unknownSlots: Array.from(unknownSlots),
  };
}
