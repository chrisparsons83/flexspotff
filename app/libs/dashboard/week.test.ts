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
  firstKickoff: new Date('2026-10-08T00:15:00Z'),
});

describe('buildMemberWeek', () => {
  it('lists nothing for a member in nothing', () => {
    expect(buildMemberWeek(nothing)).toEqual([]);
  });

  it('says how last week went and who is next in the league', () => {
    const [row] = buildMemberWeek({
      ...nothing,
      league: {
        name: 'Admiral',
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
      todo: false,
      href: '/leagues/2026/admiral/matchups',
    });
  });

  it('makes an open week with no picks a to-do, with its deadline and entry', () => {
    const [row] = buildMemberWeek({ ...nothing, spreadPool: openWeek(0) });
    expect(row).toMatchObject({
      todo: true,
      thisWeek: 'Week 5: no bets yet',
      href: '/games/spread-pool/entries/week-5',
    });
    expect(row.deadline).toEqual(new Date('2026-10-08T00:15:00Z'));
  });

  it('is not a to-do once picks are in, or before the week opens', () => {
    const rows = buildMemberWeek({
      ...nothing,
      qbStreaming: openWeek(2),
      locks: { ...openWeek(0), isOpen: false },
    });
    expect(rows.map(row => [row.label, row.todo, row.thisWeek])).toEqual([
      ['QB streaming', false, 'Week 5: 2 picks in'],
      ['Locks challenge', false, 'Week 5 not open yet'],
    ]);
  });

  it('puts to-dos first, then keeps the nav order', () => {
    const rows = buildMemberWeek({
      ...nothing,
      league: { name: 'Galaxy', lastWeek: null, thisWeek: null },
      guillotine: [
        { leagueId: 'g1', name: 'Chop', choppedWeek: null, finish: null },
      ],
      locks: openWeek(0),
      registration: { isOpen: true, isRegistered: false },
    });
    expect(rows.map(row => row.label)).toEqual([
      '2026 registration',
      'Locks challenge',
      'Galaxy',
      'Chop',
    ]);
  });

  it('shows F² and registration only while they are open', () => {
    expect(
      buildMemberWeek({
        ...nothing,
        fSquared: { isOpen: false, hasEntry: false },
        registration: { isOpen: false, isRegistered: false },
      }),
    ).toEqual([]);
    expect(
      buildMemberWeek({
        ...nothing,
        fSquared: { isOpen: true, hasEntry: true },
      })[0],
    ).toMatchObject({ label: 'F²', thisWeek: 'Entry in', todo: false });
  });
});
