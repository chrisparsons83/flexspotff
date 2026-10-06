import { suggestFromSleeperHandles } from './suggest';

const handles = [
  { displayName: 'CodeMonkey', userId: 'kevin' },
  { displayName: 'Templare1', userId: 'jack' },
  { displayName: 'Templare', userId: 'jack' },
  { displayName: 'Noro', userId: 'noro' },
  { displayName: 'Bob', userId: 'bob' },
];

describe('suggestFromSleeperHandles', () => {
  it('finds a handle inside a pick set name', () => {
    expect(
      suggestFromSleeperHandles(['Kevin', "CodeMonkey's Survival"], handles),
    ).toBe('kevin');
  });

  it('matches the nickname too', () => {
    expect(suggestFromSleeperHandles(['Noro', 'Pick Set'], handles)).toBe(
      'noro',
    );
  });

  it('treats two handles of one member as one candidate', () => {
    expect(suggestFromSleeperHandles(['Jack', 'Templare1'], handles)).toBe(
      'jack',
    );
  });

  it('ignores handles too short to mean anything', () => {
    expect(suggestFromSleeperHandles(['Bobby', 'Bob picks'], handles)).toBe('');
  });

  it('suggests nobody when two members match', () => {
    expect(suggestFromSleeperHandles(['Noro vs CodeMonkey'], handles)).toBe('');
  });
});
