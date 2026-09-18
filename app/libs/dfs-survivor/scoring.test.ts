import { scoreDfsSurvivorPlayer } from './scoring';
import { describe, expect, it } from 'vitest';

describe('scoreDfsSurvivorPlayer', () => {
  it('scores a QB at 4pt passing TDs and 1/25 yards', () => {
    // 300 pass yd, 2 pass TD, 1 INT, 20 rush yd, 1 rush TD
    expect(
      scoreDfsSurvivorPlayer('QB', {
        pass_yd: 300,
        pass_td: 2,
        pass_int: 1,
        rush_yd: 20,
        rush_td: 1,
      }),
    ).toBe(12 + 8 - 2 + 2 + 6);
  });

  it('scores a RB at half PPR', () => {
    // 100 rush yd, 1 rush TD, 5 rec for 40 yd, 1 fumble lost
    expect(
      scoreDfsSurvivorPlayer('RB', {
        rush_yd: 100,
        rush_td: 1,
        rec: 5,
        rec_yd: 40,
        fum_lost: 1,
      }),
    ).toBe(10 + 6 + 2.5 + 4 - 2);
  });

  it('scores WR and TE identically', () => {
    const line = { rec: 7, rec_yd: 95, rec_td: 1 };
    expect(scoreDfsSurvivorPlayer('WR', line)).toBe(3.5 + 9.5 + 6);
    expect(scoreDfsSurvivorPlayer('TE', line)).toBe(
      scoreDfsSurvivorPlayer('WR', line),
    );
  });

  it('scores a K on distance tiers and subtracts misses', () => {
    expect(
      scoreDfsSurvivorPlayer('K', {
        fgm_20_29: 1,
        fgm_40_49: 1,
        fgm_50p: 1,
        xpm: 3,
        fgmiss: 1,
        xpmiss: 1,
      }),
    ).toBe(3 + 4 + 5 + 3 - 1 - 1);
  });

  it('applies the DEF points-allowed and yards-allowed tiers', () => {
    // 24 points allowed (-1), 420 yards allowed (-1), 2 sacks, 1 INT
    expect(
      scoreDfsSurvivorPlayer('DEF', {
        pts_allow: 24,
        yds_allow: 420,
        sack: 2,
        int: 1,
      }),
    ).toBe(-1 - 1 + 2 + 2);
  });

  it('treats a shutout on few yards as no tier penalty', () => {
    expect(
      scoreDfsSurvivorPlayer('DEF', { pts_allow: 0, yds_allow: 200, sack: 4 }),
    ).toBe(4);
  });

  it('does not penalise a DEF whose game has not been played', () => {
    // No pts_allow/yds_allow keys at all - absent is not a shutout, but it is
    // also not a 3-point penalty.
    expect(scoreDfsSurvivorPlayer('DEF', {})).toBe(0);
  });

  it('scores an empty stat line as zero for every position', () => {
    for (const position of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']) {
      expect(scoreDfsSurvivorPlayer(position, {})).toBe(0);
    }
  });

  it('scores an unknown or missing position as zero', () => {
    expect(scoreDfsSurvivorPlayer(null, { rec: 10, rec_yd: 100 })).toBe(0);
    expect(scoreDfsSurvivorPlayer('LB', { sack: 3 })).toBe(0);
  });

  it('rounds to two decimal places', () => {
    // 0.04 * 333 = 13.32 exactly, but floating point drifts without rounding.
    expect(scoreDfsSurvivorPlayer('QB', { pass_yd: 333 })).toBe(13.32);
  });
});
