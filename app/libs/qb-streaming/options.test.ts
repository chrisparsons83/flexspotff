import { gameForTeam, isAvailableTo, matchupFor } from './options';
import { describe, expect, it } from 'vitest';

const game = {
  id: 'g1',
  homeTeamId: 'NYG',
  awayTeamId: 'DAL',
  homeTeam: 'Giants',
  awayTeam: 'Cowboys',
};

describe('gameForTeam', () => {
  it('finds the game a team plays in, home or away', () => {
    expect(gameForTeam([game], 'NYG')).toBe(game);
    expect(gameForTeam([game], 'DAL')).toBe(game);
  });

  it('finds nothing for a team on bye or no team at all', () => {
    expect(gameForTeam([game], 'SEA')).toBeUndefined();
    expect(gameForTeam([game], null)).toBeUndefined();
  });
});

describe('matchupFor', () => {
  it('reads "vs" the away team for a home QB', () => {
    expect(matchupFor('NYG', game)).toEqual({
      team: 'Giants',
      opponent: 'Cowboys',
      word: 'vs',
    });
  });

  it('reads "at" the home team for an away QB', () => {
    expect(matchupFor('DAL', game)).toEqual({
      team: 'Cowboys',
      opponent: 'Giants',
      word: 'at',
    });
  });
});

describe('isAvailableTo', () => {
  const hidden = { id: 'o1', removedAt: new Date() };

  it('hides a removed QB from everyone but the member who picked them', () => {
    expect(isAvailableTo(hidden, null)).toBe(false);
    expect(isAvailableTo(hidden, 'o2')).toBe(false);
    expect(isAvailableTo(hidden, 'o1')).toBe(true);
  });

  it('shows a listed QB to everyone', () => {
    expect(isAvailableTo({ id: 'o1', removedAt: null }, null)).toBe(true);
  });
});
