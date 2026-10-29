import { buildMemberWeek, type MemberWeekFacts } from './week';
import { describe, expect, it } from 'vitest';

const nothing: MemberWeekFacts = {
  year: 2026,
  league: null,
  guillotine: [],
  qbStreaming: null,
  spreadPool: null,
  locks: null,
  dfsSurvivor: null,
  standings: {},
  survivor: [],
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
