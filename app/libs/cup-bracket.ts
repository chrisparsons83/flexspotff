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
