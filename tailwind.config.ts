import {
  categoryFills,
  fills,
  neutralSteps,
  themeRoles,
} from './app/styles/tokens/palette';
import {
  STEP_DOWN_EM,
  TYPE_STEPS,
  type TypeStep,
} from './app/styles/tokens/scale';
import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/** A token as a Tailwind colour that takes opacity modifiers. */
const token = (name: string) => `oklch(var(--${name}) / <alpha-value>)`;
/** A token as a plain CSS colour, for places Tailwind does not process. */
const color = (name: string) => `oklch(var(--${name}))`;

/**
 * `bg-league-admiral`, `text-league-admiral-foreground`,
 * `border-league-admiral-edge`, and the same for every position, medal and
 * sequence step. Only category fills have an edge, and only
 * leagues have a tint (`bg-league-admiral-tint`).
 */
const tokenFills = Object.fromEntries(
  Object.keys(fills).map(name => [
    name,
    {
      DEFAULT: token(name),
      foreground: token(`${name}-foreground`),
      ...(name in categoryFills ? { edge: token(`${name}-edge`) } : {}),
      ...(name.startsWith('league-') ? { tint: token(`${name}-tint`) } : {}),
    },
  ]),
);

/**
 * Every theme role, with `-foreground` roles folded in as `foreground` on
 * their surface: `bg-card`, `text-card-foreground`, `text-muted-foreground`.
 */
const roleNames = Object.keys(themeRoles('dark'));
const roleColors = Object.fromEntries(
  roleNames
    .filter(name => !name.endsWith('-foreground'))
    .map(name => [
      name,
      roleNames.includes(`${name}-foreground`)
        ? { DEFAULT: token(name), foreground: token(`${name}-foreground`) }
        : token(name),
    ]),
);

/** A type step as a Tailwind font size, with its line height. */
const typeStep = (name: TypeStep): [string, string] => [
  `var(--text-${name})`,
  `var(--leading-${name})`,
];

/** The seven steps keep Tailwind's names; nothing off the scale exists. */
const fontSize = Object.fromEntries(
  TYPE_STEPS.map(name => [name, typeStep(name)]),
);

/** Prose at the type scale: body and tables at `base`, h1 to h4 above it. */
const proseStep = (name: TypeStep) => {
  const [fontSize, lineHeight] = typeStep(name);
  return { fontSize, lineHeight };
};

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx,jsx,js}',
    './components/**/*.{ts,tsx,jsx,js}',
    './app/**/*.{ts,tsx,jsx,js}',
    './src/**/*.{ts,tsx,jsx,js}',
  ],
  prefix: '',
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    fontSize,
    extend: {
      // Extended rather than replaced, so mono keeps Tailwind's full stack.
      fontFamily: {
        sans: 'var(--font-sans)',
      },
      typography: {
        DEFAULT: {
          css: {
            ...proseStep('base'),
            h1: proseStep('3xl'),
            h2: proseStep('2xl'),
            h3: proseStep('xl'),
            h4: proseStep('lg'),
            table: proseStep('base'),
            // Separate keys, so each merges into the plugin's own rule rather
            // than losing to it. Code and small text sit one step below
            // whatever holds them, so they stay on the scale inside headings.
            code: { fontSize: STEP_DOWN_EM },
            small: { fontSize: STEP_DOWN_EM },
            figcaption: proseStep('sm'),
            // Prose reads its colours from the tokens, so it follows the
            // theme without `prose-invert`.
            '--tw-prose-body': color('foreground'),
            '--tw-prose-headings': color('foreground'),
            '--tw-prose-lead': color('muted-foreground'),
            '--tw-prose-links': color('foreground'),
            '--tw-prose-bold': color('foreground'),
            '--tw-prose-counters': color('muted-foreground'),
            '--tw-prose-bullets': color('border'),
            '--tw-prose-hr': color('border'),
            '--tw-prose-quotes': color('foreground'),
            '--tw-prose-quote-borders': color('border'),
            '--tw-prose-captions': color('muted-foreground'),
            '--tw-prose-kbd': color('foreground'),
            '--tw-prose-code': color('foreground'),
            '--tw-prose-pre-code': color('foreground'),
            '--tw-prose-pre-bg': color('card'),
            '--tw-prose-th-borders': color('border'),
            '--tw-prose-td-borders': color('border'),
            // The kbd shadow variable takes RGB channels, which the tokens
            // are not, so the shadow is set directly.
            kbd: {
              boxShadow: `0 0 0 1px ${color('border')}, 0 3px 0 ${color(
                'border',
              )}`,
            },
            td: {
              verticalAlign: 'middle',
            },
          },
        },
      },
      colors: {
        ...tokenFills,
        neutral: Object.fromEntries(
          neutralSteps.map((_, i) => [i, token(`neutral-${i}`)]),
        ),
        ...roleColors,
        // Whole colours from the depth tokens, with their own opacity, so
        // no modifiers. As colours rather than arbitrary properties, so a
        // caller's own `bg-*` replaces them.
        hairline: 'var(--hairline)',
        chrome: 'var(--chrome-bg)',
        header: 'var(--header-bg)',
        control: {
          DEFAULT: 'var(--secondary-bg)',
          edge: 'var(--secondary-edge)',
        },
        tab: {
          DEFAULT: 'var(--tab-bg)',
          foreground: 'var(--tab-fg)',
          edge: 'var(--tab-edge)',
        },
      },
      borderRadius: {
        none: '0',
        sm: 'var(--radius)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius)',
        lg: 'var(--radius)',
        xl: 'var(--radius)',
        '2xl': 'var(--radius)',
        '3xl': 'var(--radius)',
        full: '9999px',
      },
      // A button can sit on a short drop in a darker shade of itself, as
      // tall as the depth tokens say (none, by default). Cards stand off the
      // page on the depth tokens' edge, and overlays float above everything.
      boxShadow: {
        press: `0 var(--press-drop) 0 0 ${color('primary-shade')}`,
        'press-secondary': `0 var(--press-drop) 0 0 ${color(
          'secondary-shade',
        )}`,
        'press-destructive': `0 var(--press-drop) 0 0 ${color(
          'destructive-shade',
        )}`,
        overlay: '0 8px 24px 0 rgb(0 0 0 / 0.4)',
        // Not `card`, which is also a colour: `shadow-card` would set the
        // shadow colour as well.
        'card-edge': 'var(--card-shadow)',
        'card-glow': 'var(--card-glow)',
        glow: 'var(--glow)',
      },
      backgroundImage: {
        'accent-gradient': 'var(--accent-gradient)',
        'primary-fill': 'var(--primary-fill)',
        'primary-fill-hover': 'var(--primary-fill-hover)',
        'header-fill': 'var(--header-fill)',
      },
      transitionDuration: {
        DEFAULT: 'var(--duration-base)',
        fast: 'var(--duration-fast)',
      },
      transitionTimingFunction: {
        DEFAULT: 'var(--ease-standard)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down':
          'accordion-down var(--duration-base) var(--ease-standard)',
        'accordion-up':
          'accordion-up var(--duration-base) var(--ease-standard)',
      },
      columns: {
        '16': '16',
      },
      gridTemplateColumns: {
        '16': 'repeat(16, minmax(1rem, 1fr))',
      },
    },
  },
  plugins: [
    // Archivo's width axis: `font-narrow` for dense views like the draft
    // board. Tailwind 3 has no font-stretch utilities of its own.
    plugin(({ addUtilities }) =>
      addUtilities({ '.font-narrow': { fontStretch: 'var(--width-narrow)' } }),
    ),
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};

export default config;
