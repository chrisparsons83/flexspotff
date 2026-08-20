import { namesLookAlike, normalizeName } from './names';
import { describe, expect, it } from 'vitest';

describe('normalizeName', () => {
  it('strips casing and punctuation', () => {
    expect(normalizeName('Brando #EAGLESUPERBOWL2024')).toBe(
      'brandoeaglesuperbowl2024',
    );
    expect(normalizeName('JesusTron6000')).toBe('jesustron6000');
  });

  it('empties a name that is all emoji or punctuation', () => {
    expect(normalizeName('🏈🏈🏈')).toBe('');
    expect(normalizeName('!!!')).toBe('');
  });
});

describe('namesLookAlike', () => {
  it('matches names that differ only in case or punctuation', () => {
    expect(namesLookAlike('WBrown', 'wbrown')).toBe(true);
    expect(namesLookAlike('Marsh Szn', 'MarshSzn')).toBe(true);
  });

  it('matches when one name contains the other', () => {
    // The case this whole feature exists for.
    expect(namesLookAlike('Panda', 'pandabair')).toBe(true);
    expect(namesLookAlike('pandabair', 'Panda')).toBe(true);
  });

  it('ignores containment too short to mean anything', () => {
    expect(namesLookAlike('Tag', 'Tager')).toBe(false);
  });

  it('never matches a name that normalizes away to nothing', () => {
    expect(namesLookAlike('🏈', '🏈')).toBe(false);
    expect(namesLookAlike('', 'Panda')).toBe(false);
  });

  it('does not match unrelated names', () => {
    expect(namesLookAlike('Panda', 'iWaffle')).toBe(false);
  });
});
