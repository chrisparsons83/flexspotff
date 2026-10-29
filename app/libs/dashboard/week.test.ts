import {
  type CupGameRow,
  type CupGameSide,
  buildMemberWeek,
  cupFacts,
  type MemberWeekFacts,
  pointsLeague,
} from './week';
import { describe, expect, it } from 'vitest';

const nothing: MemberWeekFacts = {
  year: 2026,
  league: null,
  cup: null,
  guillotine: [],
  qbStreaming: null,
  spreadPool: null,
  locks: null,
  dfsSurvivor: null,
  standings: {},
  survivor: [],
  d12: null,
  bestBall: null,
  fSquared: { isOpen: false, hasEntry: false },
  registration: { isOpen: false, isRegistered: false },
};

const openWeek = (picks: number) => ({
  id: 'week-5',
  week: 5,
  isOpen: true,
  isScored: false,
  picks,
});

describe('buildMemberWeek', () => {
  it('lists nothing for a member in nothing', () => {
    expect(buildMemberWeek(nothing)).toEqual({ todo: [], rows: [] });
  });

  it('says how last week went and who is next in the league', () => {
    const {
      rows: [row],
    } = buildMemberWeek({
      ...nothing,
      league: {
        name: 'Admiral',
        hasScores: true,
        lastWeek: {
          week: 4,
          points: 120.5,
          opponentPoints: 99.25,
          opponent: 'Herbal',
        },
        thisWeek: { week: 5, opponent: 'Jom' },
      },
    });
    expect(row).toMatchObject({
      section: 'Leagues',
      lastWeek: 'Won 120.50 to 99.25 against Herbal',
      thisWeek: 'Week 5 against Jom',
      href: '/leagues/2026/admiral/matchups',
    });
  });

  it('links to the league, not its matchups, before any week is scored', () => {
    const {
      rows: [row],
    } = buildMemberWeek({
      ...nothing,
      league: {
        name: 'Admiral',
        hasScores: false,
        lastWeek: null,
        thisWeek: { week: 1, opponent: 'Jom' },
      },
    });
    expect(row.href).toBe('/leagues/2026/admiral');
  });

  it('lists an open week with no picks to do, linking to its entry', () => {
    expect(
      buildMemberWeek({ ...nothing, spreadPool: openWeek(0) }).todo,
    ).toEqual([
      { label: 'Spread pool', href: '/games/spread-pool/entries/week-5' },
    ]);
  });

  it('lists a game to do even if the member has never played it', () => {
    const { todo, rows } = buildMemberWeek({ ...nothing, locks: openWeek(0) });
    expect(todo.map(item => item.label)).toEqual(['Locks challenge']);
    expect(rows).toEqual([]);
  });

  it('has nothing to do once picks are in, or before the week opens', () => {
    expect(
      buildMemberWeek({
        ...nothing,
        qbStreaming: openWeek(2),
        locks: { ...openWeek(0), isOpen: false },
      }).todo,
    ).toEqual([]);
  });

  it('shows where the member stands in each game they have played', () => {
    const { rows } = buildMemberWeek({
      ...nothing,
      standings: {
        spreadPool: {
          rank: 3,
          of: 24,
          total: '1240 bank',
          lastWeek: 'Week 7: +40',
        },
        locks: { rank: 11, of: 18, total: '4 pts', lastWeek: null },
      },
    });
    expect(
      rows.map(row => [row.label, row.standing, row.season, row.lastWeek]),
    ).toEqual([
      ['Spread pool', '3rd of 24', '1240 bank', 'Week 7: +40'],
      ['Locks challenge', '11th of 18', '4 pts', null],
    ]);
  });

  it('shows a game entered this week before any week is scored', () => {
    const { rows } = buildMemberWeek({ ...nothing, qbStreaming: openWeek(2) });
    expect(rows).toMatchObject([
      { label: 'QB streaming', standing: null, href: '/games/qb-streaming' },
    ]);
  });

  it('keeps the nav order: leagues, games, side leagues', () => {
    const { todo, rows } = buildMemberWeek({
      ...nothing,
      league: {
        name: 'Galaxy',
        hasScores: false,
        lastWeek: null,
        thisWeek: null,
      },
      guillotine: [
        { leagueId: 'g1', name: 'Chop', choppedWeek: null, finish: null },
      ],
      standings: { locks: { rank: 1, of: 2, total: '6 pts', lastWeek: null } },
      registration: { isOpen: true, isRegistered: false },
    });
    expect(todo.map(item => item.label)).toEqual(['2026 registration']);
    expect(rows.map(row => row.label)).toEqual([
      'Galaxy',
      '2026 registration',
      'Locks challenge',
      'Chop',
    ]);
  });

  it('shows F² and registration to do only while they are open', () => {
    expect(
      buildMemberWeek({
        ...nothing,
        fSquared: { isOpen: false, hasEntry: false },
        registration: { isOpen: false, isRegistered: false },
      }).todo,
    ).toEqual([]);
    expect(
      buildMemberWeek({
        ...nothing,
        fSquared: { isOpen: true, hasEntry: false },
      }).todo,
    ).toEqual([{ label: 'F²', href: '/games/f-squared/entries' }]);
  });
});

describe('pointsLeague', () => {
  const scores = [
    { entrant: 'me', week: 1, points: 100 },
    { entrant: 'you', week: 1, points: 120 },
    { entrant: 'them', week: 1, points: 90 },
    { entrant: 'me', week: 2, points: 130 },
    { entrant: 'you', week: 2, points: 80 },
    { entrant: 'them', week: 2, points: 95 },
    // Week 3 is still being played.
    { entrant: 'me', week: 3, points: 10 },
    { entrant: 'you', week: 3, points: 60 },
  ];

  it('places the season on every score, and last week on finished ones', () => {
    expect(pointsLeague(scores, 'me', 3)).toEqual({
      season: { rank: 2, of: 3 },
      lastWeek: { rank: 1, of: 3, week: 2, points: 130 },
    });
  });

  it('adds up an entrant’s teams in the same week, as D12 has twelve', () => {
    expect(
      pointsLeague(
        [
          { entrant: 'me', week: 1, points: 50 },
          { entrant: 'me', week: 1, points: 60 },
          { entrant: 'you', week: 1, points: 100 },
        ],
        'me',
        2,
      ).lastWeek,
    ).toEqual({ rank: 1, of: 2, week: 1, points: 110 });
  });

  it('has no last week before one is finished', () => {
    expect(pointsLeague(scores.slice(0, 3), 'me', 1)).toEqual({
      season: { rank: 2, of: 3 },
      lastWeek: null,
    });
  });

  it('has no place for an entrant with no scores yet', () => {
    expect(pointsLeague([], 'me', 1)).toEqual({ season: null, lastWeek: null });
  });
});

describe('cupFacts', () => {
  const side = (name: string, userId: string | null = name): CupGameSide => ({
    cupTeamId: `cup-${name}`,
    teamId: `team-${name}`,
    userId,
    name,
  });
  const game = (
    round: string,
    top: CupGameSide | null,
    bottom: CupGameSide | null,
    winner: CupGameSide | null = null,
  ): CupGameRow => ({
    round,
    top,
    bottom,
    winningTeamId: winner?.cupTeamId ?? null,
  });
  const me = side('me');
  const you = side('you');
  const them = side('them');
  const score = (who: CupGameSide, mapping: string, pointsScored: number) => ({
    teamId: who.teamId,
    mapping,
    pointsScored,
  });

  it('is null before the bracket has a game for them', () => {
    expect(cupFacts([game('ROUND_OF_64', you, them)], [], 'me')).toBeNull();
  });

  it('gives their newest result and their game now', () => {
    expect(
      cupFacts(
        [game('ROUND_OF_64', me, you, me), game('ROUND_OF_32', me, them)],
        [score(me, 'ROUND_OF_64', 120.5), score(you, 'ROUND_OF_64', 99.25)],
        'me',
      ),
    ).toEqual({
      lastGame: {
        round: 'ROUND_OF_64',
        won: true,
        points: 120.5,
        opponentPoints: 99.25,
        opponent: 'you',
      },
      current: { round: 'ROUND_OF_32', opponent: 'them' },
      latestRound: 'ROUND_OF_64',
    });
  });

  it('reads a game with no opponent as a bye', () => {
    expect(
      cupFacts([game('ROUND_OF_64', me, null, me)], [], 'me')?.lastGame,
    ).toMatchObject({ won: true, opponent: null });
  });
});

describe('dashboard rows for the cup, D12 and Autodraft BBM', () => {
  const cupRow = (cup: MemberWeekFacts['cup']) =>
    buildMemberWeek({ ...nothing, cup }).rows[0];
  const won = {
    round: 'ROUND_OF_32' as const,
    won: true,
    points: 120.5,
    opponentPoints: 99.25,
    opponent: 'Herbal',
  };

  it('says how the last round went and who is next', () => {
    expect(
      cupRow({
        lastGame: won,
        current: { round: 'ROUND_OF_16', opponent: 'Jom' },
        latestRound: 'ROUND_OF_32',
      }),
    ).toMatchObject({
      section: 'Leagues',
      label: 'Cup',
      lastWeek: 'Round of 32: won 120.50 to 99.25 against Herbal',
      thisWeek: 'Round of 16 against Jom',
      href: '/leagues/cup',
    });
  });

  it('keeps an old loss out of last week, and says where they went out', () => {
    expect(
      cupRow({
        lastGame: { ...won, round: 'ROUND_OF_64', won: false },
        current: null,
        latestRound: 'ROUND_OF_16',
      }),
    ).toMatchObject({ lastWeek: null, thisWeek: 'Out in the round of 64' });
  });

  it('names the champion and the runner-up', () => {
    const final = { ...won, round: 'ROUND_OF_2' as const };
    const facts = { current: null, latestRound: 'ROUND_OF_2' as const };
    expect(cupRow({ ...facts, lastGame: final }).thisWeek).toBe('Champion');
    expect(
      cupRow({ ...facts, lastGame: { ...final, won: false } }).thisWeek,
    ).toBe('Runner-up');
  });

  it('gives D12 and Autodraft BBM their week and season, in nav order', () => {
    const league = {
      season: { rank: 3, of: 12 },
      lastWeek: { rank: 2, of: 12, week: 7, points: 142.3 },
    };
    const { rows } = buildMemberWeek({
      ...nothing,
      bestBall: league,
      d12: league,
    });
    expect(rows.map(row => row.label)).toEqual(['D12', 'Autodraft BBM']);
    expect(rows[0]).toMatchObject({
      section: 'Side leagues',
      lastWeek: 'Week 7: 142.30 pts, 2nd of 12',
      thisWeek: '3rd of 12 for the season',
      href: '/side-leagues/d12',
    });
  });
});
