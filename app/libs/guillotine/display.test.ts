import { leagueKind } from './display';

describe('leagueKind', () => {
  it('tells the buy-in league from the free one by name', () => {
    expect(leagueKind('🪓 Guillotine for Business Edition')).toBe('Buy-in');
    expect(leagueKind('Guillotine for Business Edition 2022')).toBe('Buy-in');
    expect(leagueKind('Guillotine for the People')).toBe('Free');
    // 2021's league was free, and named neither.
    expect(leagueKind('Last Minute Head-Cutting-Off League')).toBe('Free');
  });
});
