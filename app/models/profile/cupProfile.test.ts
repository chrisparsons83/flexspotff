import {
  buildCareer,
  buildMatchLog,
  buildRun,
  finishLabel,
  seedingStanding,
  type CupGameInput,
  type CupSide,
  type CupRound,
} from './cupProfile';
import { describe, expect, it } from 'vitest';

describe('finishLabel', () => {
  it('names the round a run went out in', () => {
    expect(finishLabel(0)).toBe('Round of 64');
    expect(finishLabel(3)).toBe('Quarterfinals');
    expect(finishLabel(5)).toBe('Runner-up');
    expect(finishLabel(6)).toBe('Champion');
  });
});

const me: CupSide = {
  cupTeamId: 'me',
  teamId: 'my-team',
  seed: 51,
  userId: 'u-me',
  name: 'Me',
};

const other = (seed: number): CupSide => ({
  cupTeamId: `ct-${seed}`,
  teamId: `team-${seed}`,
  seed,
  userId: `u-${seed}`,
  name: `Seed ${seed}`,
});

const game = (
  round: CupRound,
  opponent: CupSide | null,
  winner: CupSide | null,
  extra: Partial<CupGameInput> = {},
): CupGameInput => ({
  round,
  containsBye: false,
  top: opponent && opponent.seed < me.seed ? opponent : me,
  bottom: opponent && opponent.seed < me.seed ? me : opponent,
  winningTeamId: winner?.cupTeamId ?? null,
  losingTeamId: winner
    ? winner === me
      ? opponent?.cupTeamId ?? null
      : me.cupTeamId
    : null,
  ...extra,
});

const run = (
  games: CupGameInput[],
  side: CupSide = me,
  scores: Record<string, number> = {},
) =>
  buildRun({
    year: 2024,
    leagueName: 'Dragon',
    cupTeamId: side.cupTeamId,
    teamId: side.teamId,
    seed: side.seed,
    fieldSize: 60,
    seedingPoints: 400,
    games,
    scoreFor: (teamId, round) => scores[`${teamId}:${round}`] ?? null,
    weeksInRound: round =>
      round === 'ROUND_OF_64' || round === 'ROUND_OF_32' ? 1 : 2,
  });

describe('buildRun', () => {
  // The 51 seed who beat 14 and 19 before 3 knocked them out: both wins were
  // upsets, and the loss to a better seed was not.
  it('follows a Cinderella run round by round', () => {
    const result = run([
      game('ROUND_OF_16', other(3), other(3)),
      game('ROUND_OF_64', other(14), me),
      game('ROUND_OF_32', other(19), me),
    ]);

    expect(result.rounds.map(r => r.round)).toEqual([
      'ROUND_OF_64',
      'ROUND_OF_32',
      'ROUND_OF_16',
    ]);
    expect(result.rounds.map(r => r.status)).toEqual(['W', 'W', 'L']);
    expect(result.rounds.map(r => r.upset)).toEqual([true, true, false]);
    expect(result).toMatchObject({
      depth: 2,
      status: 'eliminated',
      finish: 'Round of 16',
      eliminatedBy: { seed: 3, name: 'Seed 3' },
    });
  });

  it('counts a bye as a round survived but not a game', () => {
    const topSeed: CupSide = { ...me, cupTeamId: 'top', seed: 2 };
    const result = run(
      [
        {
          round: 'ROUND_OF_64',
          containsBye: true,
          top: topSeed,
          bottom: null,
          winningTeamId: 'top',
          losingTeamId: null,
        },
        {
          round: 'ROUND_OF_32',
          containsBye: false,
          top: topSeed,
          bottom: other(31),
          winningTeamId: 'ct-31',
          losingTeamId: 'top',
        },
      ],
      topSeed,
    );

    expect(result.rounds.map(r => r.status)).toEqual(['BYE', 'L']);
    expect(result.rounds[0].opponent).toBeNull();
    expect(result.rounds[1].upset).toBe(true);
    expect(result.depth).toBe(1);
  });

  it('marks a run with an unscored game as still alive', () => {
    const result = run([
      game('ROUND_OF_64', other(14), me),
      game('ROUND_OF_32', null, null),
    ]);

    expect(result.status).toBe('alive');
    expect(result.finish).toBe('Alive in the Round of 32');
    expect(result.rounds[1]).toMatchObject({
      status: 'PENDING',
      opponent: null,
    });
  });

  it('crowns a run that won every round', () => {
    const top: CupSide = { ...me, seed: 1 };
    const rounds: CupRound[] = [
      'ROUND_OF_64',
      'ROUND_OF_32',
      'ROUND_OF_16',
      'ROUND_OF_8',
      'ROUND_OF_4',
      'ROUND_OF_2',
    ];
    const result = run(
      rounds.map((round, i) => ({
        round,
        containsBye: false,
        top,
        bottom: other(64 - i),
        winningTeamId: top.cupTeamId,
        losingTeamId: `ct-${64 - i}`,
      })),
      top,
    );

    expect(result).toMatchObject({
      status: 'champion',
      finish: 'Champion',
      eliminatedBy: null,
    });
  });

  it('reads points from the lookup and flags a tie settled by seed', () => {
    const result = run([game('ROUND_OF_64', other(14), other(14))], me, {
      'my-team:ROUND_OF_64': 101.5,
      'team-14:ROUND_OF_64': 101.5,
    });

    expect(result.rounds[0]).toMatchObject({
      points: 101.5,
      opponentPoints: 101.5,
      decidedBySeed: true,
      upset: false,
    });
  });
  it('counts a recorded winner as a loss even without a losing side', () => {
    const result = run([
      { ...game('ROUND_OF_64', other(14), other(14)), losingTeamId: null },
    ]);

    expect(result.rounds[0].status).toBe('L');
    expect(result.status).toBe('eliminated');
  });

  it('does not credit the higher seed with a tie the lower seed won', () => {
    const result = run([game('ROUND_OF_64', other(14), me)], me, {
      'my-team:ROUND_OF_64': 101.5,
      'team-14:ROUND_OF_64': 101.5,
    });

    expect(result.rounds[0]).toMatchObject({
      decidedBySeed: false,
      upset: true,
    });
  });
});

describe('buildCareer', () => {
  const cinderella = run([
    game('ROUND_OF_64', other(14), me),
    game('ROUND_OF_32', other(19), me),
    game('ROUND_OF_16', other(3), other(3)),
  ]);
  const upsetLoss = {
    ...run([game('ROUND_OF_64', other(55), other(55))], {
      ...me,
      seed: 10,
    }),
    year: 2023,
  };

  it('adds up the record and upsets, and finds the best run', () => {
    const career = buildCareer([cinderella, upsetLoss]);

    expect(career).toMatchObject({
      wins: 2,
      losses: 2,
      byes: 0,
      upsetsWon: 2,
      upsetsLost: 1,
      titles: 0,
      bestRun: { depth: 2, finish: 'Round of 16', year: 2024 },
    });
  });
});

describe('buildMatchLog', () => {
  it('runs newest year first and latest round first', () => {
    const early = {
      ...run([game('ROUND_OF_64', other(14), other(14))]),
      year: 2022,
    };
    const late = run([
      game('ROUND_OF_64', other(14), me),
      game('ROUND_OF_32', other(19), other(19)),
    ]);

    expect(
      buildMatchLog([early, late]).map(row => [row.year, row.round]),
    ).toEqual([
      [2024, 'ROUND_OF_32'],
      [2024, 'ROUND_OF_64'],
      [2022, 'ROUND_OF_64'],
    ]);
  });
});

describe('seedingStanding', () => {
  it('ranks by total points, best first', () => {
    const standing = seedingStanding(
      [
        { teamId: 'a', points: 300 },
        { teamId: 'b', points: 420 },
        { teamId: 'c', points: 350 },
      ],
      'c',
    );

    expect(standing).toEqual({ rank: 2, fieldSize: 3, points: 350 });
  });

  it('is null for a member with no team this year', () => {
    expect(seedingStanding([{ teamId: 'a', points: 1 }], 'z')).toBeNull();
  });
});
