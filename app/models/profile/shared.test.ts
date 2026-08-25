import {
  aggregateCareerStats,
  aggregateCupStats,
  aggregatePlayoffStats,
  computeStreak,
  medianGames,
  pairTeamGames,
  totalGames,
  winPct,
} from './shared.server';
import { describe, expect, it } from 'vitest';

const team = (
  userId: string | null,
  overrides: Partial<{
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
    medianWins: number;
    medianLosses: number;
    medianTies: number;
    name: string;
  }> = {},
) => ({
  userId,
  user: { discordName: overrides.name ?? 'Member' },
  wins: overrides.wins ?? 0,
  losses: overrides.losses ?? 0,
  ties: overrides.ties ?? 0,
  pointsFor: overrides.pointsFor ?? 0,
  pointsAgainst: overrides.pointsAgainst ?? 0,
  medianWins: overrides.medianWins ?? 0,
  medianLosses: overrides.medianLosses ?? 0,
  medianTies: overrides.medianTies ?? 0,
});

describe('record helpers', () => {
  it('counts head-to-head games and ignores median games', () => {
    expect(totalGames({ wins: 7, losses: 5, ties: 1 })).toBe(13);
  });

  it('returns zero win pct rather than dividing by zero', () => {
    expect(winPct({ wins: 0, losses: 0, ties: 0 })).toBe(0);
  });

  it('treats a tie as neither a win nor a loss', () => {
    expect(winPct({ wins: 6, losses: 6, ties: 1 })).toBeCloseTo(6 / 13);
  });

  it('counts median games separately', () => {
    expect(medianGames({ medianWins: 7, medianLosses: 6, medianTies: 0 })).toBe(
      13,
    );
  });
});

describe('aggregateCareerStats', () => {
  it('sums a member seasons into one career line', () => {
    const careers = aggregateCareerStats([
      team('u1', { wins: 8, losses: 5, pointsFor: 1500, medianWins: 7 }),
      team('u1', { wins: 6, losses: 7, pointsFor: 1400, medianWins: 6 }),
    ]);

    expect(careers.get('u1')).toMatchObject({
      seasons: 2,
      wins: 14,
      losses: 12,
      pointsFor: 2900,
      medianWins: 13,
    });
  });

  // Unclaimed Sleeper rosters would otherwise show up as a phantom member.
  it('skips teams with no member attached', () => {
    const careers = aggregateCareerStats([
      team(null, { wins: 10 }),
      team('u1', { wins: 3 }),
    ]);

    expect(careers.size).toBe(1);
    expect(careers.get('u1')!.wins).toBe(3);
  });

  it('keeps members apart', () => {
    const careers = aggregateCareerStats([
      team('u1', { wins: 9, name: 'Alex' }),
      team('u2', { wins: 4, name: 'Sam' }),
    ]);

    expect(careers.get('u1')!.name).toBe('Alex');
    expect(careers.get('u2')!.name).toBe('Sam');
  });

  it('falls back to Unknown when a member has no display name', () => {
    const careers = aggregateCareerStats([
      { ...team('u1'), user: { discordName: null } },
    ]);

    expect(careers.get('u1')!.name).toBe('Unknown');
  });
});

describe('pairTeamGames', () => {
  const game = (
    teamId: string,
    week: number,
    sleeperMatchupId: number,
    pointsScored: number,
    leagueId = 'league-1',
  ) => ({
    teamId,
    week,
    sleeperMatchupId,
    pointsScored,
    team: { leagueId },
  });

  it('returns both sides of a matchup with results resolved', () => {
    const paired = pairTeamGames([game('a', 1, 1, 120), game('b', 1, 1, 100)]);

    expect(paired).toHaveLength(2);
    expect(paired.find(p => p.game.teamId === 'a')!.result).toBe('W');
    expect(paired.find(p => p.game.teamId === 'b')!.result).toBe('L');
  });

  it('marks equal scores as ties on both sides', () => {
    const paired = pairTeamGames([game('a', 1, 1, 100), game('b', 1, 1, 100)]);

    expect(paired.map(p => p.result)).toEqual(['T', 'T']);
  });

  // Sleeper reuses matchup ids every week. Without the week in the key, these
  // four games collapse into one group and nothing pairs at all - the bug that
  // silently emptied the streak records before.
  it('keeps the same matchup id in different weeks apart', () => {
    const paired = pairTeamGames([
      game('a', 1, 1, 120),
      game('b', 1, 1, 100),
      game('a', 2, 1, 90),
      game('b', 2, 1, 110),
    ]);

    expect(paired).toHaveLength(4);
    const week2 = paired.filter(p => p.game.week === 2);
    expect(week2.find(p => p.game.teamId === 'a')!.result).toBe('L');
  });

  it('keeps the same matchup id in different leagues apart', () => {
    const paired = pairTeamGames([
      game('a', 1, 1, 120, 'league-1'),
      game('b', 1, 1, 100, 'league-1'),
      game('c', 1, 1, 90, 'league-2'),
      game('d', 1, 1, 95, 'league-2'),
    ]);

    expect(paired).toHaveLength(4);
    expect(paired.find(p => p.game.teamId === 'c')!.opponent.teamId).toBe('d');
  });

  it('drops a game with no opponent', () => {
    expect(pairTeamGames([game('a', 1, 1, 120)])).toEqual([]);
  });

  it('drops a group with more than two teams', () => {
    const paired = pairTeamGames([
      game('a', 1, 1, 120),
      game('b', 1, 1, 100),
      game('c', 1, 1, 90),
    ]);

    expect(paired).toEqual([]);
  });
});

describe('computeStreak', () => {
  it('finds the longest run, not the first or last', () => {
    const streak = computeStreak(
      ['W', 'W', 'L', 'W', 'W', 'W', 'L', 'W'],
      result => result === 'W',
    );

    expect(streak).toEqual({ length: 3, startIndex: 3, endIndex: 5 });
  });

  it('handles a run that reaches the end', () => {
    const streak = computeStreak(['L', 'W', 'W'], r => r === 'W');

    expect(streak).toEqual({ length: 2, startIndex: 1, endIndex: 2 });
  });

  it('returns null when nothing matches', () => {
    expect(computeStreak(['L', 'L'], r => r === 'W')).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(computeStreak([], () => true)).toBeNull();
  });

  it('keeps the first of two equally long runs', () => {
    const streak = computeStreak(['W', 'W', 'L', 'W', 'W'], r => r === 'W');

    expect(streak).toMatchObject({ length: 2, startIndex: 0 });
  });
});

describe('aggregateCupStats', () => {
  const side = (userId: string | null, name = 'Member') => ({
    team: { userId, user: { discordName: name } },
  });

  it('counts games played for both sides and a win for the winner', () => {
    const stats = aggregateCupStats([
      {
        round: 'ROUND_OF_8',
        topTeam: side('u1'),
        bottomTeam: side('u2'),
        winningTeam: side('u1'),
      },
    ]);

    expect(stats.get('u1')).toMatchObject({ gamesPlayed: 1, gameWins: 1 });
    expect(stats.get('u2')).toMatchObject({ gamesPlayed: 1, gameWins: 0 });
  });

  // ROUND_OF_2 is the final: both sides reached it, and the winner is champion.
  it('counts the final as a finals appearance for both and a title for the winner', () => {
    const stats = aggregateCupStats([
      {
        round: 'ROUND_OF_2',
        topTeam: side('u1'),
        bottomTeam: side('u2'),
        winningTeam: side('u2'),
      },
    ]);

    expect(stats.get('u1')).toMatchObject({
      finalsAppearances: 1,
      championships: 0,
    });
    expect(stats.get('u2')).toMatchObject({
      finalsAppearances: 1,
      championships: 1,
    });
  });

  it('ignores sides with no member attached', () => {
    const stats = aggregateCupStats([
      {
        round: 'ROUND_OF_4',
        topTeam: side(null),
        bottomTeam: side('u2'),
        winningTeam: side('u2'),
      },
    ]);

    expect(stats.size).toBe(1);
  });
});

describe('aggregatePlayoffStats', () => {
  const side = (userId: string | null, name = 'Member') => ({
    userId,
    user: { discordName: name },
  });

  const playoffGame = (
    overrides: Partial<{
      bracket: 'WINNERS' | 'LOSERS';
      isTitleGame: boolean;
      countsTowardRecord: boolean;
      leagueId: string;
      topTeam: ReturnType<typeof side>;
      bottomTeam: ReturnType<typeof side>;
      winningTeam: ReturnType<typeof side>;
    }> = {},
  ) => ({
    bracket: overrides.bracket ?? ('WINNERS' as const),
    isTitleGame: overrides.isTitleGame ?? false,
    countsTowardRecord: overrides.countsTowardRecord ?? true,
    leagueId: overrides.leagueId ?? 'league-1',
    topTeam: overrides.topTeam ?? side('u1'),
    bottomTeam: overrides.bottomTeam ?? side('u2'),
    winningTeam: overrides.winningTeam ?? side('u1'),
  });

  it('records a win and a loss for a counting game', () => {
    const stats = aggregatePlayoffStats([playoffGame()]);

    expect(stats.get('u1')).toMatchObject({ wins: 1, losses: 0 });
    expect(stats.get('u2')).toMatchObject({ wins: 0, losses: 1 });
  });

  // The rule the league asked for: winning the third-place game is not a
  // playoff win.
  it('ignores results from games that do not count toward the record', () => {
    const stats = aggregatePlayoffStats([
      playoffGame({ countsTowardRecord: false }),
    ]);

    expect(stats.get('u1')).toMatchObject({ wins: 0, losses: 0 });
    expect(stats.get('u2')).toMatchObject({ wins: 0, losses: 0 });
  });

  it('credits a championship for the winners bracket title game', () => {
    const stats = aggregatePlayoffStats([
      playoffGame({ isTitleGame: true, bracket: 'WINNERS' }),
    ]);

    expect(stats.get('u1')).toMatchObject({
      championships: 1,
      toiletBowls: 0,
    });
  });

  it('credits a toilet bowl for the losers bracket title game', () => {
    const stats = aggregatePlayoffStats([
      playoffGame({ isTitleGame: true, bracket: 'LOSERS' }),
    ]);

    expect(stats.get('u1')).toMatchObject({
      championships: 0,
      toiletBowls: 1,
    });
  });

  it('counts one appearance per league however long the run', () => {
    const stats = aggregatePlayoffStats([
      playoffGame({ leagueId: 'league-1' }),
      playoffGame({ leagueId: 'league-1' }),
      playoffGame({ leagueId: 'league-2' }),
    ]);

    expect(stats.get('u1')!.appearances).toBe(2);
  });

  // A losers bracket run is not a playoff berth.
  it('does not count a losers bracket game as a playoff appearance', () => {
    const stats = aggregatePlayoffStats([
      playoffGame({ bracket: 'LOSERS', leagueId: 'league-1' }),
    ]);

    expect(stats.get('u1')!.appearances).toBe(0);
  });

  it('ignores a game that has not been played yet', () => {
    const stats = aggregatePlayoffStats([
      {
        bracket: 'WINNERS',
        isTitleGame: false,
        countsTowardRecord: true,
        leagueId: 'league-1',
        topTeam: side('u1'),
        bottomTeam: side('u2'),
        winningTeam: null,
      },
    ]);

    expect(stats.get('u1')).toMatchObject({ wins: 0, losses: 0 });
  });
});
