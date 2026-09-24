/** Cup rounds from the final outward, indexed by `CupGame.roundSort`. */
export const cupRounds = [
  'ROUND_OF_2',
  'ROUND_OF_4',
  'ROUND_OF_8',
  'ROUND_OF_16',
  'ROUND_OF_32',
  'ROUND_OF_64',
];

/**
 * Round-of-64 pairings by seed, in bracket order. Neighbouring games feed the
 * same game in the next round, so this order decides every later pairing too.
 */
export const roundOf64Matches = [
  [1, 64],
  [32, 33],
  [17, 48],
  [16, 49],
  [9, 56],
  [24, 41],
  [25, 40],
  [8, 57],
  [4, 61],
  [29, 36],
  [20, 45],
  [13, 52],
  [12, 53],
  [21, 44],
  [28, 37],
  [5, 60],
  [2, 63],
  [31, 34],
  [18, 47],
  [15, 50],
  [10, 55],
  [23, 42],
  [26, 39],
  [7, 58],
  [3, 62],
  [30, 35],
  [19, 46],
  [14, 51],
  [11, 54],
  [22, 43],
  [27, 38],
  [6, 59],
];

/**
 * Which side of a cup game advances. The higher seed - the lower seed number -
 * takes a tie (rule 12.4), and a side with no opponent walks through.
 *
 * Scores are compared to the hundredth, since a two-week round is a sum of
 * floats and a real tie can come out a hair apart.
 */
export function decideCupGame({
  topScore,
  bottomScore,
  topSeed,
  bottomSeed,
}: {
  topScore: number;
  bottomScore: number;
  topSeed: number;
  bottomSeed: number | null;
}): 'top' | 'bottom' {
  if (bottomSeed === null) return 'top';

  const top = Math.round(topScore * 100);
  const bottom = Math.round(bottomScore * 100);
  if (top !== bottom) return top > bottom ? 'top' : 'bottom';
  return topSeed < bottomSeed ? 'top' : 'bottom';
}
