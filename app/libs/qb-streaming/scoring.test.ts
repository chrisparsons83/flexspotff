import { scoreQbStats } from './scoring';
import { describe, expect, it } from 'vitest';

describe('scoreQbStats', () => {
  it('scores an empty stat line as zero', () => {
    expect(scoreQbStats({})).toBe(0);
  });

  it('scores passing, rushing and turnovers to the cent', () => {
    expect(
      scoreQbStats({
        pass_yd: 243,
        pass_td: 1,
        pass_int: 1,
        rush_yd: -1,
        fum_lost: 1,
        pass_2pt: 1,
      }),
    ).toBe(11.62);
  });

  it('counts receiving like rushing', () => {
    expect(scoreQbStats({ rec_yd: 20, rec_td: 1, rec_2pt: 1 })).toBe(10);
  });
});
