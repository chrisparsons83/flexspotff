import type { PickerGameInput, PickerPlayerInput } from './picker';
import { decoratePickerPlayers } from './picker';
import { describe, expect, it } from 'vitest';

const KICKOFF = new Date('2026-09-20T17:00:00Z');
const NOW = new Date('2026-09-18T12:00:00Z');

const team = (id: string, sleeperId: string) => ({ id, sleeperId });

const player = (
  overrides: Partial<PickerPlayerInput> & Pick<PickerPlayerInput, 'id'>,
): PickerPlayerInput => ({
  fullName: 'Test Player',
  position: 'WR',
  currentNFLTeamId: 'team-buf',
  currentNFLTeam: team('team-buf', 'BUF'),
  ...overrides,
});

const game = (overrides: Partial<PickerGameInput> = {}): PickerGameInput => ({
  homeTeamId: 'team-buf',
  awayTeamId: 'team-mia',
  homeTeam: team('team-buf', 'BUF'),
  awayTeam: team('team-mia', 'MIA'),
  gameStartTime: KICKOFF,
  ...overrides,
});

const decorate = (
  players: PickerPlayerInput[],
  games: PickerGameInput[],
  extra: Partial<Parameters<typeof decoratePickerPlayers>[0]> = {},
) =>
  decoratePickerPlayers({
    players,
    games,
    projections: new Map(),
    seasonTotals: new Map(),
    usage: new Map(),
    currentTime: NOW,
    ...extra,
  });

describe('decoratePickerPlayers', () => {
  it('marks a home player with their away opponent', () => {
    const [row] = decorate([player({ id: 'p1' })], [game()]);

    expect(row.isHome).toBe(true);
    expect(row.opponentAbbr).toBe('MIA');
  });

  it('marks an away player with their home opponent', () => {
    const [row] = decorate(
      [
        player({
          id: 'p1',
          currentNFLTeamId: 'team-mia',
          currentNFLTeam: team('team-mia', 'MIA'),
        }),
      ],
      [game()],
    );

    expect(row.isHome).toBe(false);
    expect(row.opponentAbbr).toBe('BUF');
  });

  it('reports no opponent for a team on bye', () => {
    const [row] = decorate(
      [
        player({
          id: 'p1',
          currentNFLTeamId: 'team-kc',
          currentNFLTeam: team('team-kc', 'KC'),
        }),
      ],
      [game()],
    );

    expect(row.opponentAbbr).toBeNull();
    // A bye is not a lock - there is simply nothing to pick.
    expect(row.isLocked).toBe(false);
  });

  it('joins on the team FK, not the denormalised team abbreviation', () => {
    // A traded player whose `currentNFLTeam` is MIA must get MIA's game, even
    // though their old team also plays this week.
    const traded = player({
      id: 'p1',
      currentNFLTeamId: 'team-mia',
      currentNFLTeam: team('team-mia', 'MIA'),
    });

    const [row] = decorate(
      [traded],
      [
        game({
          homeTeamId: 'team-nyj',
          awayTeamId: 'team-ne',
          homeTeam: team('team-nyj', 'NYJ'),
          awayTeam: team('team-ne', 'NE'),
        }),
        game(),
      ],
    );

    expect(row.teamAbbr).toBe('MIA');
    expect(row.opponentAbbr).toBe('BUF');
  });

  it('locks a player whose game has already kicked off', () => {
    const [row] = decorate(
      [player({ id: 'p1' })],
      [game({ gameStartTime: new Date('2026-09-17T17:00:00Z') })],
    );

    expect(row.isLocked).toBe(true);
  });

  it('does not lock a game starting exactly now plus a second', () => {
    const [row] = decorate(
      [player({ id: 'p1' })],
      [game({ gameStartTime: new Date(NOW.getTime() + 1000) })],
    );

    expect(row.isLocked).toBe(false);
  });

  it('shows a defense as its team abbreviation', () => {
    const [row] = decorate(
      [
        player({
          id: 'def-buf',
          fullName: 'Buffalo Bills',
          position: 'DEF',
        }),
      ],
      [game()],
    );

    expect(row.name).toBe('BUF');
    expect(row.position).toBe('DEF');
  });

  it('keeps the full name for non-defense positions', () => {
    const [row] = decorate(
      [player({ id: 'p1', fullName: 'Josh Allen', position: 'QB' })],
      [game()],
    );

    expect(row.name).toBe('Josh Allen');
  });

  it('carries projections and season totals, defaulting sensibly', () => {
    const [withData, without] = decorate(
      [player({ id: 'p1' }), player({ id: 'p2' })],
      [game()],
      {
        projections: new Map([['p1', 14.2]]),
        seasonTotals: new Map([['p1', 61.5]]),
      },
    );

    expect(withData.projection).toBe(14.2);
    expect(withData.seasonPoints).toBe(61.5);
    // No projection is null (renders as a dash), but no points really is zero.
    expect(without.projection).toBeNull();
    expect(without.seasonPoints).toBe(0);
  });

  it('reports the week and score of a player already used in a scored week', () => {
    const [used, unused] = decorate(
      [player({ id: 'p1' }), player({ id: 'p2' })],
      [game()],
      { usage: new Map([['p1', { week: 3, points: 6.7, isScored: true }]]) },
    );

    expect(used.usedInWeek).toBe(3);
    expect(used.usedPoints).toBe(6.7);
    expect(unused.usedInWeek).toBeNull();
    expect(unused.usedPoints).toBeNull();
  });

  it('withholds the score of a used week that has not been scored yet', () => {
    // `points` defaults to 0 on an unscored entry, which would otherwise read
    // as a genuine zero-point outing.
    const [row] = decorate([player({ id: 'p1' })], [game()], {
      usage: new Map([['p1', { week: 3, points: 0, isScored: false }]]),
    });

    expect(row.usedInWeek).toBe(3);
    expect(row.usedPoints).toBeNull();
  });

  it('handles a player with no current team at all', () => {
    const [row] = decorate(
      [player({ id: 'p1', currentNFLTeamId: null, currentNFLTeam: null })],
      [game()],
    );

    expect(row.teamAbbr).toBe('');
    expect(row.opponentAbbr).toBeNull();
    expect(row.isLocked).toBe(false);
  });
});
