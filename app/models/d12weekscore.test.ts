import type { D12WeekScoreRow } from './d12weekscore.server';
import { computeD12Leaderboard } from './d12weekscore.server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/db.server', () => ({ prisma: {} }));

type WeekScores = D12WeekScoreRow[];

const score = (
  userId: string,
  discordName: string,
  leagueName: string,
  week: number,
  points: number,
  lineup?: Pick<D12WeekScoreRow, 'starters' | 'startingPlayerPoints'>,
): D12WeekScoreRow => ({
  userId,
  week,
  points,
  d12LeagueId: leagueName,
  league: { name: leagueName },
  user: { discordName, discordAvatar: '' },
  ...lineup,
});

describe('computeD12Leaderboard', () => {
  it("reports each manager's highest-scoring single team", () => {
    const [madmike] = computeD12Leaderboard([
      score('u1', 'madmike', 'v6', 1, 46),
      score('u1', 'madmike', 'v2', 1, 31),
      score('u1', 'madmike', 'v9', 1, 40),
    ] as WeekScores);

    expect(madmike.bestLeagueName).toBe('v6');
    expect(madmike.bestLeaguePoints).toBe(46);
    // The best team is one team's season total, not the best week across all.
    expect(madmike.totalPoints).toBe(117);
  });

  it('sums a team across weeks before picking the best one', () => {
    const [manager] = computeD12Leaderboard([
      score('u1', 'madmike', 'v6', 1, 46),
      score('u1', 'madmike', 'v2', 1, 31),
      score('u1', 'madmike', 'v2', 2, 40),
    ] as WeekScores);

    // v2 trails in week 1 but wins on the season, 71 to 46.
    expect(manager.bestLeagueName).toBe('v2');
    expect(manager.bestLeaguePoints).toBe(71);
  });

  it('breaks a tie on league name, whatever order the rows arrive in', () => {
    const pick = (rows: WeekScores) =>
      computeD12Leaderboard(rows)[0].bestLeagueName;

    expect(
      pick([
        score('u1', 'madmike', 'v9', 1, 46),
        score('u1', 'madmike', 'v2', 1, 46),
      ] as WeekScores),
    ).toBe('v2');
    // Same two teams, opposite order, same answer.
    expect(
      pick([
        score('u1', 'madmike', 'v2', 1, 46),
        score('u1', 'madmike', 'v9', 1, 46),
      ] as WeekScores),
    ).toBe('v2');
  });

  it('leaves the best team blank for a manager with nothing but zeroes', () => {
    const [manager] = computeD12Leaderboard([
      score('u1', 'madmike', 'v6', 1, 0),
    ] as WeekScores);

    expect(manager.bestLeagueName).toBe('');
    expect(manager.bestWeek).toBe(0);
  });

  it("carries a team's lineup through when a single week went into it", () => {
    const [manager] = computeD12Leaderboard([
      score('u1', 'madmike', 'v6', 1, 115.9, {
        starters: ['12545', '4034'],
        startingPlayerPoints: [26.45, 11.3],
      }),
    ] as WeekScores);

    expect(manager.byLeague[0].weekCount).toBe(1);
    expect(manager.byLeague[0].starters).toEqual(['12545', '4034']);
    expect(manager.byLeague[0].startingPlayerPoints).toEqual([26.45, 11.3]);
  });

  it('drops the lineup once a team spans more than one week', () => {
    const [manager] = computeD12Leaderboard([
      score('u1', 'madmike', 'v6', 1, 46, {
        starters: ['a'],
        startingPlayerPoints: [46],
      }),
      score('u1', 'madmike', 'v6', 2, 40, {
        starters: ['b'],
        startingPlayerPoints: [40],
      }),
    ] as WeekScores);

    // Two weeks summed have no one lineup behind them, so there is nothing to
    // show rather than whichever week's happened to arrive first.
    expect(manager.byLeague[0].weekCount).toBe(2);
    expect(manager.byLeague[0].points).toBe(86);
    expect(manager.byLeague[0].starters).toEqual([]);
    expect(manager.byLeague[0].startingPlayerPoints).toEqual([]);
  });

  it('ranks managers by total points, sharing a rank on a tie', () => {
    const leaderboard = computeD12Leaderboard([
      score('u1', 'madmike', 'v6', 1, 46),
      score('u2', 'selyk', 'v6', 1, 60),
      score('u3', 'greg_irl', 'v2', 1, 60),
    ] as WeekScores);

    expect(leaderboard.map(e => [e.discordName, e.rank])).toEqual([
      ['selyk', 1],
      ['greg_irl', 1],
      ['madmike', 3],
    ]);
  });
});
