import {
  categoryFills,
  fills,
  neutralSteps,
} from './app/styles/tokens/palette';
import type { Config } from 'tailwindcss';

/** A token as a Tailwind colour that takes opacity modifiers. */
const token = (name: string) => `oklch(var(--${name}) / <alpha-value>)`;
/** A token as a plain CSS colour, for places Tailwind does not process. */
const color = (name: string) => `oklch(var(--${name}))`;

/**
 * `bg-league-admiral`, `text-league-admiral-foreground`,
 * `border-league-admiral-edge`, and the same for every position, medal and
 * sequence step. Only category fills have an edge.
 */
const tokenFills = Object.fromEntries(
  Object.keys(fills).map(name => [
    name,
    {
      DEFAULT: token(name),
      foreground: token(`${name}-foreground`),
      ...(name in categoryFills ? { edge: token(`${name}-edge`) } : {}),
    },
  ]),
);

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
    extend: {
      typography: {
        DEFAULT: {
          css: {
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
        // The names routes use today. They point at the tokens so existing
        // classes pick up the new colours; #195 moves routes onto the
        // `league-*`, `position-*` and `medal-*` names and removes these.
        admiral: token('league-admiral'),
        champions: token('league-champions'),
        dragon: token('league-dragon'),
        galaxy: token('league-galaxy'),
        monarch: token('league-monarch'),
        gold: token('medal-gold'),
        silver: token('medal-silver'),
        bronze: token('medal-bronze'),
        brown: { DEFAULT: token('medal-sacko'), light: token('medal-sacko') },
        qb: token('position-qb'),
        rb: token('position-rb'),
        wr: token('position-wr'),
        te: token('position-te'),
        def: token('position-def'),
        ...Object.fromEntries(
          [
            'background',
            'foreground',
            'border',
            'input',
            'ring',
            'negative',
            'warning',
            'positive',
            'info',
          ].map(name => [name, token(name)]),
        ),
        ...Object.fromEntries(
          [
            'card',
            'popover',
            'primary',
            'secondary',
            'muted',
            'accent',
            'destructive',
          ].map(name => [
            name,
            { DEFAULT: token(name), foreground: token(`${name}-foreground`) },
          ]),
        ),
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
    require('tailwindcss-animate'),
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};

export default config;
