import { projectDfsLineup, projectDfsSlot } from './projection';
import { describe, expect, it } from 'vitest';

const kickoff = new Date('2026-11-22T18:00:00Z');
const minutesAfterKickoff = (minutes: number) =>
  new Date(kickoff.getTime() + minutes * 60_000);

describe('projectDfsSlot', () => {
  it('counts the whole projection before kickoff', () => {
    expect(
      projectDfsSlot(
        {
          points: null,
          projection: 14.2,
          game: { state: 'pre_game', kickoff },
        },
        minutesAfterKickoff(-30),
      ),
    ).toEqual({ state: 'projected', points: 0, projected: 14.2 });
  });

  it('counts only real points once the game is over', () => {
    expect(
      projectDfsSlot(
        {
          points: 21.4,
          projection: 14.2,
          game: { state: 'complete', kickoff },
        },
        minutesAfterKickoff(200),
      ),
    ).toEqual({ state: 'final', points: 21.4, projected: 21.4 });
  });

  // Half way through: 8 scored plus half of a 10-point projection still to come.
  it('adds the unplayed share of the projection to a live game', () => {
    expect(
      projectDfsSlot(
        { points: 8, projection: 10, game: { state: 'in_game', kickoff } },
        minutesAfterKickoff(92.5),
      ),
    ).toEqual({ state: 'live', points: 8, projected: 13 });
  });

  it('reads a live game with no stat line yet as nothing scored so far', () => {
    expect(
      projectDfsSlot(
        { points: null, projection: 10, game: { state: 'in_game', kickoff } },
        minutesAfterKickoff(92.5),
      ),
    ).toEqual({ state: 'live', points: 0, projected: 5 });
  });

  // A stat line that has not landed yet is not a final 0.
  it('keeps the projection for a finished game whose stats have not arrived', () => {
    expect(
      projectDfsSlot(
        { points: null, projection: 12, game: { state: 'complete', kickoff } },
        minutesAfterKickoff(200),
      ),
    ).toEqual({ state: 'projected', points: 0, projected: 12 });
  });

  it('projects nothing for a player with no projection', () => {
    expect(
      projectDfsSlot(
        {
          points: null,
          projection: null,
          game: { state: 'pre_game', kickoff },
        },
        minutesAfterKickoff(-30),
      ),
    ).toEqual({ state: 'projected', points: 0, projected: 0 });
  });
});

describe('projectDfsLineup', () => {
  it('totals points and projected finish, and knows a game has kicked off', () => {
    const lineup = projectDfsLineup(
      [
        {
          points: 21.4,
          projection: 14.2,
          game: { state: 'complete', kickoff },
        },
        { points: 8, projection: 10, game: { state: 'in_game', kickoff } },
        {
          points: null,
          projection: 9.15,
          game: { state: 'pre_game', kickoff },
        },
      ],
      minutesAfterKickoff(92.5),
    );

    expect(lineup.total).toEqual({ points: 29.4, projected: 43.55 });
    expect(lineup.hasKickedOff).toBe(true);
  });

  it('has not kicked off while every game is still to come', () => {
    const lineup = projectDfsLineup(
      [{ points: null, projection: 9, game: { state: 'pre_game', kickoff } }],
      minutesAfterKickoff(-30),
    );

    expect(lineup.hasKickedOff).toBe(false);
    expect(lineup.total).toEqual({ points: 0, projected: 9 });
  });
});
