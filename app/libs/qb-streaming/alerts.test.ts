import { weekChangedAlert, weekOpenedAlert } from './alerts';
import { describe, expect, it } from 'vitest';

describe('weekOpenedAlert', () => {
  it('lists every QB by pool, sorted by name', () => {
    expect(
      weekOpenedAlert(9, [
        { fullName: 'Zach Wilson', isDeep: true, matchup: 'DEN at KC' },
        { fullName: 'Andy Dalton', isDeep: true, matchup: 'CAR vs ATL' },
        { fullName: 'Kirk Cousins', isDeep: false, matchup: 'ATL at CAR' },
      ]),
    ).toBe(
      [
        'QB Streaming week 9 is open with 3 QBs.',
        '',
        '**Both pools (2)**',
        'Andy Dalton, CAR vs ATL',
        'Zach Wilson, DEN at KC',
        '',
        '**Standard only (1)**',
        'Kirk Cousins, ATL at CAR',
      ].join('\n'),
    );
  });
});

describe('weekChangedAlert', () => {
  it('is null when nothing changed', () => {
    expect(
      weekChangedAlert(9, { added: [], restored: [], removed: [] }),
    ).toBeNull();
  });

  it('lists only the sections that changed, with each QB pool', () => {
    expect(
      weekChangedAlert(9, {
        added: [
          { fullName: 'Andy Dalton', isDeep: true, matchup: 'CAR vs ATL' },
        ],
        restored: [],
        removed: [
          { fullName: 'Kirk Cousins', isDeep: false, matchup: 'ATL at CAR' },
        ],
      }),
    ).toBe(
      [
        'QB Streaming week 9 has changed.',
        '',
        '**Added**',
        'Andy Dalton, CAR vs ATL, both pools',
        '',
        '**Removed, projected at 0**',
        'Kirk Cousins, ATL at CAR, standard only',
      ].join('\n'),
    );
  });
});
