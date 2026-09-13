import { computeD12Leaderboard } from './d12weekscore.server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/db.server', () => ({ prisma: {} }));

type WeekScores = Parameters<typeof computeD12Leaderboard>[0];

const score = (
  userId: string,
  discordName: string,
  leagueName: string,
  week: number,
  points: number,
) =>
  ({
    userId,
    week,
    points,
    d12LeagueId: leagueName,
    league: { name: leagueName },
    user: { discordName, discordAvatar: '' },
  } as unknown as WeekScores[number]);

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
