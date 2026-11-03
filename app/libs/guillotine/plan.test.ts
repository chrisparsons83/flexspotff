import type {
  GuillotineSleeperData,
  GuillotineSyncPlan,
  StoredGuillotineLeague,
} from './plan';
import { departedOwners, planGuillotineSync, syncWeeks } from './plan';
import type {
  SleeperGuillotineRostersJson,
  SleeperMatchupJson,
  SleeperTransaction,
} from '~/libs/sleeper/schemas';

type Roster = SleeperGuillotineRostersJson[number];
type MatchupRow = SleeperMatchupJson[number];

const roster = (rosterId: number, extra: Partial<Roster> = {}): Roster => ({
  roster_id: rosterId,
  owner_id: `owner-${rosterId}`,
  players: ['p1'],
  starters: null,
  settings: null,
  ...extra,
});

const row = (
  rosterId: number,
  points: number,
  extra: Partial<MatchupRow> = {},
): MatchupRow => ({
  roster_id: rosterId,
  points,
  matchup_id: null,
  starters: [`s${rosterId}`],
  starters_points: [points],
  players: ['p1'],
  ...extra,
});

const transaction = (
  id: string,
  leg: number,
  extra: Partial<SleeperTransaction> = {},
): SleeperTransaction => ({
  type: 'waiver',
  status: 'complete',
  transaction_id: id,
  leg,
  creator: 'owner-1',
  roster_ids: [1],
  settings: { waiver_bid: 5, seq: 1 },
  metadata: null,
  adds: { p9: 1 },
  drops: null,
  status_updated: 1_700_000_000_000,
  ...extra,
});

/**
 * A native three-team league with week 2 scored and week 3 live: roster 3
 * was chopped in week 1, roster 2 in week 2.
 */
function sleeperData(
  extra: Partial<GuillotineSleeperData> = {},
): GuillotineSleeperData {
  return {
    info: {
      name: 'The Guillotine',
      season: '2026',
      status: 'in_season',
      total_rosters: 3,
      scoring_settings: { rec: 0.5 },
      settings: { last_scored_leg: 2, waiver_budget: 100 },
    },
    rosters: [
      roster(1, {
        starters: ['live1', null],
        settings: { waiver_budget_used: 12 },
      }),
      roster(2, { players: [], settings: { eliminated: 2 } }),
      roster(3, { players: [], settings: { eliminated: 1 } }),
    ],
    users: [
      { user_id: 'owner-1', display_name: 'One' },
      { user_id: 'owner-2', username: 'two' },
      { user_id: 'owner-3', display_name: 'Three' },
    ],
    departedUsers: [],
    draft: undefined,
    matchups: new Map([
      [1, [row(1, 100), row(2, 90), row(3, 80)]],
      [2, [row(1, 110), row(2, 70), row(3, 0, { players: [] })]],
      [
        3,
        [
          row(1, 20, { starters: null, starters_points: null }),
          row(2, 0, { players: [] }),
          row(3, 0, { players: [] }),
        ],
      ],
    ]),
    transactions: [],
    picks: [],
    projections: { live1: { rec: 6 } },
    projectionError: null,
    ...extra,
  };
}

function stored(
  extra: Partial<StoredGuillotineLeague> = {},
): StoredGuillotineLeague {
  return {
    format: 'NATIVE',
    ownerToUserId: new Map([
      ['owner-1', 'user-1'],
      ['owner-2', 'user-2'],
      ['owner-3', 'user-3'],
    ]),
    liveWeekScores: [],
    ...extra,
  };
}

const team = (plan: GuillotineSyncPlan, rosterId: number) => {
  const found = plan.teams.find(t => t.rosterId === rosterId);
  if (!found) throw new Error(`No team for roster ${rosterId}`);
  return found;
};

describe('planGuillotineSync', () => {
  it('keeps week scores only for the weeks a team was alive', () => {
    const plan = planGuillotineSync(sleeperData(), stored());

    expect(team(plan, 1).weekScores.map(w => w.week)).toEqual([1, 2, 3]);
    expect(team(plan, 2).weekScores.map(w => w.week)).toEqual([1, 2]);
    expect(team(plan, 3).weekScores.map(w => w.week)).toEqual([1]);
    expect(team(plan, 2).data.choppedWeek).toBe(2);
    expect(team(plan, 1).data.waiverBudgetUsed).toBe(12);
  });

  it("projects the live week's starters, falling back to the roster's lineup", () => {
    const plan = planGuillotineSync(sleeperData(), stored());
    const [week1, , week3] = team(plan, 1).weekScores;

    expect(week3.starters).toEqual(['live1', '0']);
    expect(week3.starterProjections).toEqual([3, 0]);
    expect(week1.starters).toEqual(['s1']);
    expect(week1.starterProjections).toEqual([]);
  });

  it('keeps the stored projections when the fetch failed, and warns', () => {
    const plan = planGuillotineSync(
      sleeperData({ projections: null, projectionError: 'timed out' }),
      stored({
        liveWeekScores: [{ starters: ['live1', '0'], starterProjections: [9] }],
      }),
    );

    expect(team(plan, 1).weekScores[2].starterProjections).toEqual([9, 0]);
    expect(plan.warnings).toContain(
      'Week 3 projections could not be loaded (timed out), so the chop line shows points only.',
    );
  });

  it('leaves a hand-assigned member alone when no owner can be found', () => {
    const data = sleeperData();
    data.rosters[2] = { ...data.rosters[2], owner_id: null };
    const plan = planGuillotineSync(data, stored());

    expect(team(plan, 3).data).not.toHaveProperty('userId');
    expect(team(plan, 3).data.sleeperOwnerId).toBeNull();
    expect(team(plan, 1).data.userId).toBe('user-1');
    expect(team(plan, 1).data.sleeperDisplayName).toBe('One');
    expect(team(plan, 2).data.sleeperDisplayName).toBe('two');
  });

  it('names a departed owner from their own lookup', () => {
    const data = sleeperData({
      departedUsers: [{ user_id: 'gone', display_name: 'Gone' }],
    });
    data.rosters[2] = { ...data.rosters[2], owner_id: null };
    data.picks = [
      { round: 1, roster_id: 3, player_id: 'p', picked_by: 'gone', pick_no: 3 },
    ];
    const plan = planGuillotineSync(data, stored());

    expect(team(plan, 3).data.sleeperOwnerId).toBe('gone');
    expect(team(plan, 3).data.sleeperDisplayName).toBe('Gone');
    expect(team(plan, 3).data.userId).toBeNull();
  });

  it("takes draft slots from the draft's roster order first", () => {
    const plan = planGuillotineSync(
      sleeperData({
        draft: {
          draft_id: 'd1',
          status: 'complete',
          slot_to_roster_id: { '1': 2, '2': null },
          draft_order: { 'owner-1': 3 },
        },
        picks: [
          {
            round: 1,
            roster_id: 3,
            player_id: 'a',
            picked_by: null,
            pick_no: 1,
          },
          {
            round: 2,
            roster_id: 3,
            player_id: 'b',
            picked_by: null,
            pick_no: 4,
          },
        ],
      }),
      stored(),
    );

    expect(team(plan, 2).data.draftSlot).toBe(1);
    expect(team(plan, 1).data.draftSlot).toBe(3);
    expect(team(plan, 3).data.draftSlot).toBe(1);
    expect(plan.league.sleeperDraftId).toBe('d1');
    expect(plan.draftPicks).toEqual([
      { pickNo: 1, round: 1, rosterId: 3, sleeperId: 'a' },
      { pickNo: 4, round: 2, rosterId: 3, sleeperId: 'b' },
    ]);
  });

  it('writes a transaction two legs both carry once, from the first leg', () => {
    const plan = planGuillotineSync(
      sleeperData({
        transactions: [
          transaction('t1', 1),
          transaction('t2', 2),
          transaction('t1', 2),
        ],
      }),
      stored(),
    );

    expect(plan.transactions.map(t => [t.sleeperTransactionId, t.leg])).toEqual(
      [
        ['t1', 1],
        ['t2', 2],
      ],
    );
    expect(plan.transactions[0]).toMatchObject({
      type: 'waiver',
      bid: 5,
      seq: 1,
      notes: null,
      adds: { p9: 1 },
      processedAt: new Date(1_700_000_000_000),
    });
  });

  it('sets the league from its info, not complete before the final', () => {
    const plan = planGuillotineSync(sleeperData(), stored());

    expect(plan.league).toEqual({
      name: 'The Guillotine',
      sleeperDraftId: null,
      teamCount: 3,
      waiverBudget: 100,
      scoringSettings: { rec: 0.5 },
      lastScoredWeek: 2,
      isComplete: false,
    });
  });
});

describe('syncWeeks', () => {
  it('asks for every scored week and the live one', () => {
    expect(
      syncWeeks({
        name: 'L',
        status: 'in_season',
        settings: { last_scored_leg: 2 },
      }),
    ).toEqual({
      lastScoredWeek: 2,
      throughWeek: 3,
      weekNumbers: [1, 2, 3],
      liveWeek: 3,
    });
  });

  it('has no live week once the season is complete', () => {
    expect(
      syncWeeks({
        name: 'L',
        status: 'complete',
        settings: { last_scored_leg: 18 },
      }).liveWeek,
    ).toBeNull();
  });
});

describe('departedOwners', () => {
  it('lists owners found elsewhere who are not in the users list', () => {
    expect(
      departedOwners({
        rosters: [roster(1), roster(2, { owner_id: null })],
        users: [{ user_id: 'owner-1' }],
        picks: [],
        transactions: [
          transaction('t1', 1, { creator: 'gone', roster_ids: [2] }),
        ],
      }),
    ).toEqual(['gone']);
  });
});
