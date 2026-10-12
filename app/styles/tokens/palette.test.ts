import { contrast, distance, hexToOklch, oklchToHex } from './color';
import { renderTokensCss, TOKENS_CSS_PATH } from './css';
import {
  categoryFills,
  EDGE_PAIRS,
  FILL_CONTRAST,
  FILL_GROUNDS,
  fillEdges,
  fillHueGaps,
  leagueTints,
  fills,
  leagues,
  TEXT_CONTRAST,
  TEXT_PAIRS,
  textOn,
  sequence,
  themeRoles,
  THEMES,
} from './palette';
import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { LEAGUE_EMBED_COLORS } from '~/utils/constants';

/**
 * Fills too close in lightness to a ground or card for the fill alone to
 * show. These are the ones that get an edge.
 */
const OUTLINED: Record<(typeof THEMES)[number], string[]> = {
  dark: [],
  light: [
    'league-admiral',
    'league-champions',
    'league-galaxy',
    'medal-gold',
    'medal-silver',
    'medal-bronze',
    'medal-sacko',
  ],
};

describe('tokens.css', () => {
  it('matches the generator', () => {
    expect(readFileSync(TOKENS_CSS_PATH, 'utf8')).toBe(renderTokensCss());
  });
});

describe('league colours', () => {
  it('stay exactly the Discord role colours', () => {
    for (const [name, color] of Object.entries(leagues)) {
      const hex = LEAGUE_EMBED_COLORS[name as keyof typeof leagues]
        .toString(16)
        .padStart(6, '0');
      expect(oklchToHex(color)).toBe(`#${hex}`);
    }
  });
});

describe.each(THEMES)('%s theme', theme => {
  const roles = themeRoles(theme);

  it.each(TEXT_PAIRS)('%s reads as text on %s', (text, ground) => {
    expect(contrast(roles[text], roles[ground])).toBeGreaterThanOrEqual(
      TEXT_CONTRAST,
    );
  });

  it.each(EDGE_PAIRS)('%s is visible as an edge on %s', (edge, ground) => {
    expect(contrast(roles[edge], roles[ground])).toBeGreaterThanOrEqual(
      FILL_CONTRAST,
    );
  });

  it.each(FILL_GROUNDS)(
    'shows every category fill, or its edge, on %s',
    ground => {
      const edges = fillEdges(theme);
      for (const name of Object.keys(categoryFills)) {
        expect(
          contrast(edges[`${name}-edge`], roles[ground]),
        ).toBeGreaterThanOrEqual(FILL_CONTRAST);
      }
    },
  );

  it.each(['foreground', 'muted-foreground'] as const)(
    'reads %s on every league tint',
    text => {
      for (const tint of Object.values(leagueTints(theme))) {
        expect(contrast(roles[text], tint)).toBeGreaterThanOrEqual(
          TEXT_CONTRAST,
        );
      }
    },
  );

  it('outlines only the fills too faint for the ground', () => {
    const edges = fillEdges(theme);
    const outlined = Object.keys(categoryFills).filter(
      name => edges[`${name}-edge`] !== categoryFills[name],
    );
    expect(outlined).toEqual(OUTLINED[theme]);
  });
});

describe('fills', () => {
  it.each(Object.keys(fills))('%s carries readable text', name => {
    const fill = fills[name];
    expect(contrast(textOn(fill), fill)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it('keeps every category fill distinguishable from the others', () => {
    const colors = Object.values(categoryFills);
    const closest = Math.min(
      ...colors.flatMap((a, i) => colors.slice(i + 1).map(b => distance(a, b))),
    );
    expect(closest).toBeGreaterThanOrEqual(0.07);
  });
});

describe('sequence', () => {
  it('steps evenly from dark to light, each step distinct', () => {
    sequence.slice(1).forEach((step, i) => {
      expect(step.l).toBeGreaterThan(sequence[i].l);
      expect(distance(step, sequence[i])).toBeGreaterThanOrEqual(0.07);
    });
  });
});

describe('fillHueGaps', () => {
  it('places each hue in the widest remaining gap', () => {
    expect(fillHueGaps([0, 90], 3)).toEqual([225, 157.5, 292.5]);
  });

  it('needs a hue to start from', () => {
    expect(() => fillHueGaps([], 3)).toThrow();
  });
});

describe('hexToOklch', () => {
  it('reads short hex', () => {
    expect(hexToOklch('#fff')).toEqual(hexToOklch('#ffffff'));
  });

  it('rejects anything else', () => {
    expect(() => hexToOklch('#ffff')).toThrow();
  });
});
