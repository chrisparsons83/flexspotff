import { bestBallLineup } from './best-ball';
import { describe, expect, it } from 'vitest';

const D12_SLOTS = [
  'QB',
  'RB',
  'RB',
  'WR',
  'WR',
  'TE',
  'FLEX',
  'FLEX',
  ...Array(9).fill('BN'),
];

/**
 * The bug this module exists for: christhrowrocks' roster in The D12 v12, 2026
 * week 1, taken off /v1/league/1365741870633742336/matchups/1. Sleeper's own
 * `points` field read 45.30 - the frozen starters array, which benched Shough,
 * Kincaid, Wicks and Diggs (all done playing) in favour of Mahomes, Rice and
 * Walker on 0.00 with their games not yet kicked off. Sleeper's UI showed
 * 115.90, which is what the optimal lineup is worth.
 */
const ROSTER = [
  ['12545', 'QB', 26.45], // Tyler Shough
  ['10236', 'TE', 19.25], // Dalton Kincaid
  ['9486', 'WR', 15.55], // Dontayvion Wicks
  ['2449', 'WR', 15.25], // Stefon Diggs
  ['4034', 'RB', 11.3], // Christian McCaffrey
  ['7543', 'RB', 11.3], // Travis Etienne
  ['9484', 'TE', 10.25], // Tucker Kraft
  ['13279', 'WR', 6.55], // Carnell Tate
  ['11586', 'RB', 5.9], // Blake Corum
  ['10229', 'WR', 0], // Rashee Rice
  ['11618', 'WR', 0], // Jalen McMillan
  ['12469', 'RB', 0], // Dylan Sampson
  ['12535', 'WR', 0], // Isaac TeSlaa
  ['13281', 'WR', 0], // Jordyn Tyson
  ['4046', 'QB', 0], // Patrick Mahomes
  ['5045', 'WR', 0], // Courtland Sutton
  ['8151', 'RB', 0], // Kenneth Walker
] as const;

const playersPoints = Object.fromEntries(
  ROSTER.map(([sleeperId, , points]) => [sleeperId, points]),
);
const positionBySleeperId = new Map<string, string | null>(
  ROSTER.map(([sleeperId, position]) => [sleeperId, position]),
);

describe('bestBallLineup', () => {
  it("matches Sleeper's own best-ball total, which its API does not report", () => {
    const lineup = bestBallLineup({
      rosterPositions: D12_SLOTS,
      playersPoints,
      positionBySleeperId,
    });

    expect(lineup.points).toBe(115.9);
    // In roster_positions order, so the grid reads QB, RB, RB, WR, WR, TE, FLEX,
    // FLEX even though the slots are filled most-restrictive-first.
    expect(lineup.starters).toEqual([
      '12545', // QB  Shough     26.45
      '4034', // RB  McCaffrey  11.30
      '7543', // RB  Etienne    11.30
      '9486', // WR  Wicks      15.55
      '2449', // WR  Diggs      15.25
      '10236', // TE  Kincaid    19.25
      '9484', // FLEX Kraft     10.25
      '13279', // FLEX Tate       6.55
    ]);
    expect(lineup.startingPlayerPoints).toEqual([
      26.45, 11.3, 11.3, 15.55, 15.25, 19.25, 10.25, 6.55,
    ]);
    expect(lineup.unplaceable).toEqual([]);
    expect(lineup.unknownSlots).toEqual([]);
  });

  it('gives FLEX the best leftover whatever position it plays', () => {
    const lineup = bestBallLineup({
      rosterPositions: ['RB', 'FLEX'],
      playersPoints: { rb1: 5, rb2: 4, wr1: 20 },
      positionBySleeperId: new Map([
        ['rb1', 'RB'],
        ['rb2', 'RB'],
        ['wr1', 'WR'],
      ]),
    });

    // The dedicated RB slot takes the best RB, and FLEX prefers the WR to the
    // second RB rather than filling by position.
    expect(lineup.starters).toEqual(['rb1', 'wr1']);
    expect(lineup.points).toBe(25);
  });

  it('never starts a player twice', () => {
    const lineup = bestBallLineup({
      rosterPositions: ['TE', 'FLEX'],
      playersPoints: { te1: 20 },
      positionBySleeperId: new Map([['te1', 'TE']]),
    });

    expect(lineup.starters).toEqual(['te1', '0']);
    expect(lineup.points).toBe(20);
  });

  it('leaves a slot empty when no eligible player is left', () => {
    const lineup = bestBallLineup({
      rosterPositions: ['QB', 'RB', 'RB'],
      playersPoints: { rb1: 9 },
      positionBySleeperId: new Map([['rb1', 'RB']]),
    });

    expect(lineup.starters).toEqual(['0', 'rb1', '0']);
    expect(lineup.startingPlayerPoints).toEqual([0, 9, 0]);
    expect(lineup.points).toBe(9);
  });

  it('scores nobody off the bench', () => {
    const lineup = bestBallLineup({
      rosterPositions: ['QB', 'BN', 'IR', 'TAXI'],
      playersPoints: { qb1: 30, qb2: 25 },
      positionBySleeperId: new Map([
        ['qb1', 'QB'],
        ['qb2', 'QB'],
      ]),
    });

    expect(lineup.starters).toEqual(['qb1']);
    expect(lineup.points).toBe(30);
  });

  it('reports a scoring player we have no position for', () => {
    const lineup = bestBallLineup({
      rosterPositions: ['QB', 'FLEX'],
      playersPoints: { qb1: 30, rookie: 22, bench: 0 },
      positionBySleeperId: new Map([
        ['qb1', 'QB'],
        ['rookie', null],
      ]),
    });

    // The total is an undercount and says so, rather than looking correct.
    expect(lineup.points).toBe(30);
    expect(lineup.unplaceable).toEqual(['rookie']);
  });

  it('keeps two decimals rather than a float sum', () => {
    const lineup = bestBallLineup({
      rosterPositions: ['WR', 'WR', 'WR'],
      playersPoints: { a: 0.1, b: 0.2, c: 0.3 },
      positionBySleeperId: new Map([
        ['a', 'WR'],
        ['b', 'WR'],
        ['c', 'WR'],
      ]),
    });

    expect(lineup.points).toBe(0.6);
  });

  it('ignores a slot type it does not know rather than guessing', () => {
    const lineup = bestBallLineup({
      rosterPositions: ['QB', 'DL'],
      playersPoints: { qb1: 30, wr1: 22 },
      positionBySleeperId: new Map([
        ['qb1', 'QB'],
        ['wr1', 'WR'],
      ]),
    });

    expect(lineup.starters).toEqual(['qb1', '0']);
    expect(lineup.points).toBe(30);
    // The slot was left empty, so the total is an undercount and says which slot
    // did it rather than leaving the 22 unexplained.
    expect(lineup.unknownSlots).toEqual(['DL']);
  });
});
