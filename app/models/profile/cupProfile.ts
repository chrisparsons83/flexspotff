/**
 * The Cup half of a member's profile, as pure functions over rows the loader
 * has already fetched, so the rules that are easy to get wrong - byes, seed
 * expectations, upsets, ties - can be tested without a database.
 *
 * The bracket is 64 slots, seeded by points over the opening weeks, with the
 * pairings fixed so the better seed is always favoured. Around 60 teams enter,
 * so the top seeds open with a bye. Rounds after the first can span two weeks,
 * in which case the cup score is the sum of both.
 */

export const CUP_ROUNDS = [
  'ROUND_OF_64',
  'ROUND_OF_32',
  'ROUND_OF_16',
  'ROUND_OF_8',
  'ROUND_OF_4',
  'ROUND_OF_2',
] as const;

export type CupRound = (typeof CUP_ROUNDS)[number];

export const ROUND_SHORT: Record<CupRound, string> = {
  ROUND_OF_64: 'R64',
  ROUND_OF_32: 'R32',
  ROUND_OF_16: 'R16',
  ROUND_OF_8: 'QF',
  ROUND_OF_4: 'SF',
  ROUND_OF_2: 'F',
};

export const ROUND_LABEL: Record<CupRound, string> = {
  ROUND_OF_64: 'Round of 64',
  ROUND_OF_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  ROUND_OF_8: 'Quarterfinals',
  ROUND_OF_4: 'Semifinals',
  ROUND_OF_2: 'Final',
};

export function isCupRound(round: string): round is CupRound {
  return (CUP_ROUNDS as readonly string[]).includes(round);
}

/** How many rounds a bracket has - winning all of them is a title. */
export const ROUNDS_TO_WIN = CUP_ROUNDS.length;

/** Seeds that open with a bye, going by every Cup so far having 60 teams. */
export const BYE_SEEDS = 4;

/** Where a run ended, from how many rounds it survived. */
export function finishLabel(depth: number): string {
  if (depth >= ROUNDS_TO_WIN) return 'Champion';
  if (depth === ROUNDS_TO_WIN - 1) return 'Runner-up';
  return ROUND_LABEL[CUP_ROUNDS[depth]];
}

export type CupSide = {
  cupTeamId: string;
  teamId: string;
  seed: number;
  userId: string | null;
  name: string;
};

export type CupGameInput = {
  round: string;
  containsBye: boolean;
  winningTeamId: string | null;
  losingTeamId: string | null;
  top: CupSide | null;
  bottom: CupSide | null;
};

export type CupOpponent = {
  userId: string | null;
  name: string;
  seed: number;
};

export type RoundResult = {
  round: CupRound;
  /** PENDING is a game in the bracket that has not been scored yet. */
  status: 'W' | 'L' | 'BYE' | 'PENDING';
  /** Null for a bye, or a next-round slot still waiting on its other side. */
  opponent: CupOpponent | null;
  points: number | null;
  opponentPoints: number | null;
  /** Weeks the round spans; a two-week round's points are both weeks added. */
  weeks: number;
  /** Beat a better seed (on a win), or lost to a worse one (on a loss). */
  upset: boolean;
  /** Level on points, so the better seed went through under rule 12.4. */
  decidedBySeed: boolean;
};

export type CupRun = {
  year: number;
  leagueName: string;
  seed: number;
  fieldSize: number;
  seedingPoints: number | null;
  /** The rounds they were in, first round first. */
  rounds: RoundResult[];
  /** Rounds survived, byes included; six is a title. */
  depth: number;
  status: 'champion' | 'eliminated' | 'alive';
  finish: string;
  eliminatedBy: CupOpponent | null;
};

export type ScoreLookup = (teamId: string, round: CupRound) => number | null;

const toOpponent = (side: CupSide): CupOpponent => ({
  userId: side.userId,
  name: side.name,
  seed: side.seed,
});

/** Same hundredth-of-a-point comparison the admin scoring uses. */
const samePoints = (a: number, b: number) =>
  Math.round(a * 100) === Math.round(b * 100);

export function buildRun({
  year,
  leagueName,
  cupTeamId,
  teamId,
  seed,
  fieldSize,
  seedingPoints,
  games,
  scoreFor,
  weeksInRound,
}: {
  year: number;
  leagueName: string;
  cupTeamId: string;
  teamId: string;
  seed: number;
  fieldSize: number;
  seedingPoints: number | null;
  games: CupGameInput[];
  scoreFor: ScoreLookup;
  weeksInRound: (round: CupRound) => number;
}): CupRun {
  const rounds: RoundResult[] = games
    .filter(game => isCupRound(game.round))
    .map(game => {
      const round = game.round as CupRound;
      const opponentSide =
        game.top?.cupTeamId === cupTeamId ? game.bottom : game.top;
      const weeks = weeksInRound(round);

      if (game.containsBye) {
        return {
          round,
          status: 'BYE' as const,
          opponent: null,
          points: null,
          opponentPoints: null,
          weeks,
          upset: false,
          decidedBySeed: false,
        };
      }

      // Any recorded winner other than them is a loss, whether or not the
      // losing side was filled in too.
      const status =
        game.winningTeamId === cupTeamId
          ? ('W' as const)
          : game.winningTeamId !== null
          ? ('L' as const)
          : ('PENDING' as const);

      const points = scoreFor(teamId, round);
      const opponentPoints = opponentSide
        ? scoreFor(opponentSide.teamId, round)
        : null;

      const upset =
        opponentSide !== null &&
        ((status === 'W' && seed > opponentSide.seed) ||
          (status === 'L' && seed < opponentSide.seed));

      return {
        round,
        status,
        opponent: opponentSide ? toOpponent(opponentSide) : null,
        points,
        opponentPoints,
        weeks,
        upset,
        // Only when the better seed actually went through - cups scored before
        // rule 12.4 was enforced gave ties to the worse seed.
        decidedBySeed:
          opponentSide !== null &&
          points !== null &&
          opponentPoints !== null &&
          samePoints(points, opponentPoints) &&
          ((status === 'W' && seed < opponentSide.seed) ||
            (status === 'L' && seed > opponentSide.seed)),
      };
    })
    .sort((a, b) => CUP_ROUNDS.indexOf(a.round) - CUP_ROUNDS.indexOf(b.round));

  const depth = rounds.filter(
    r => r.status === 'W' || r.status === 'BYE',
  ).length;
  const loss = rounds.find(r => r.status === 'L') ?? null;
  const status: CupRun['status'] =
    depth >= ROUNDS_TO_WIN ? 'champion' : loss ? 'eliminated' : 'alive';

  return {
    year,
    leagueName,
    seed,
    fieldSize,
    seedingPoints,
    rounds,
    depth,
    status,
    finish:
      status === 'alive'
        ? `Alive in the ${ROUND_LABEL[CUP_ROUNDS[depth]]}`
        : finishLabel(depth),
    eliminatedBy: loss?.opponent ?? null,
  };
}

export type CupCareer = {
  wins: number;
  losses: number;
  byes: number;
  upsetsWon: number;
  upsetsLost: number;
  titles: number;
  finals: number;
  finalFours: number;
  /** The deepest run, and the most recent one if several went as far. */
  bestRun: { depth: number; finish: string; year: number } | null;
};

export function buildCareer(runs: CupRun[]): CupCareer {
  const results = runs.flatMap(run =>
    run.rounds.map(result => ({ run, result })),
  );
  const count = (predicate: (r: RoundResult) => boolean) =>
    results.filter(({ result }) => predicate(result)).length;

  const bestRun = runs.reduce<CupRun | null>(
    (best, run) =>
      !best ||
      run.depth > best.depth ||
      (run.depth === best.depth && run.year > best.year)
        ? run
        : best,
    null,
  );

  return {
    wins: count(r => r.status === 'W'),
    losses: count(r => r.status === 'L'),
    byes: count(r => r.status === 'BYE'),
    upsetsWon: count(r => r.status === 'W' && r.upset),
    upsetsLost: count(r => r.status === 'L' && r.upset),
    titles: runs.filter(run => run.status === 'champion').length,
    finals: runs.filter(run => run.depth >= ROUNDS_TO_WIN - 1).length,
    finalFours: runs.filter(run => run.depth >= ROUNDS_TO_WIN - 2).length,
    bestRun: bestRun && {
      depth: bestRun.depth,
      finish: bestRun.finish,
      year: bestRun.year,
    },
  };
}

export type MatchLogRow = RoundResult & { year: number; seed: number };

/** Every cup game they have been in, newest first and latest round first. */
export function buildMatchLog(runs: CupRun[]): MatchLogRow[] {
  return runs
    .flatMap(run =>
      run.rounds.map(result => ({ ...result, year: run.year, seed: run.seed })),
    )
    .sort(
      (a, b) =>
        b.year - a.year ||
        CUP_ROUNDS.indexOf(b.round) - CUP_ROUNDS.indexOf(a.round),
    );
}

/**
 * Where a member stands while this year's seeding weeks are still being
 * played, ranked the way the admin page will seed them: total points, best
 * first.
 */
export function seedingStanding(
  totals: { teamId: string; points: number }[],
  teamId: string,
): { rank: number; fieldSize: number; points: number } | null {
  const sorted = [...totals].sort((a, b) => b.points - a.points);
  const index = sorted.findIndex(row => row.teamId === teamId);
  if (index === -1) return null;
  return {
    rank: index + 1,
    fieldSize: sorted.length,
    points: sorted[index].points,
  };
}
