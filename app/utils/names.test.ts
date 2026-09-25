import { createMemberSuggester, namesLookAlike, normalizeName } from './names';
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

describe('createMemberSuggester', () => {
  const members = [
    { id: 'klay', discordName: 'klaystation' },
    { id: 'panda', discordName: 'Panda' },
    { id: 'pandabair', discordName: 'pandabair' },
    { id: 'rob-1', discordName: 'Rob' },
    { id: 'rob-2', discordName: 'rob' },
  ];

  it('suggests an exact match only when it is unique', () => {
    const suggest = createMemberSuggester(members);

    expect(suggest('PANDA')).toBe('panda');
    expect(suggest('Rob')).toBe('');
  });

  it('tries each name in turn', () => {
    expect(createMemberSuggester(members)(null, 'nobody', 'Pandabair')).toBe(
      'pandabair',
    );
  });

  it('only falls back to look-alikes when asked to', () => {
    expect(createMemberSuggester(members)('Klay')).toBe('');
    expect(createMemberSuggester(members, { lookAlike: true })('Klay')).toBe(
      'klay',
    );
  });

  it('does not suggest a look-alike two members share', () => {
    // Both "Panda" and "pandabair" are inside "pandabair2".
    expect(
      createMemberSuggester(members, { lookAlike: true })('pandabair2'),
    ).toBe('');
  });
});
