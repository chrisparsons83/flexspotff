/**
 * Tokens that are not colours. Corners are near-square and set once here.
 * Motion is for state changes only, so there are two short durations and
 * one easing curve.
 *
 * Spacing and the layout grid use Tailwind's 4px scale and its grid columns
 * as they stand; they are already one systematic scale.
 */

/** The spacing unit. Every line height is a whole number of these. */
export const GRID_UNIT = 4;

// Type scale

/** Each step is the one below it times the ratio. */
export const TYPE_BASE = 16;
export const TYPE_RATIO = 1.2;

/**
 * The seven steps, smallest first, by the Tailwind name each one takes. `base`
 * is body text and tables; the steps above it are headings.
 */
export const TYPE_STEPS = [
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
] as const;
const BASE_INDEX = TYPE_STEPS.indexOf('base');

/** Text needs looser leading than headings. Both round up to the grid. */
const BODY_LEADING = 1.45;
const HEADING_LEADING = 1.2;

export type TypeStep = (typeof TYPE_STEPS)[number];

/**
 * Each step's size in px, and its leading as a unitless ratio. The ratio
 * puts the line on the grid at the step's own size, and scales with the text
 * when something inside sets a different size.
 */
export const typeScale = Object.fromEntries(
  TYPE_STEPS.map((name, i) => {
    const size = TYPE_BASE * TYPE_RATIO ** (i - BASE_INDEX);
    const target = i <= BASE_INDEX ? BODY_LEADING : HEADING_LEADING;
    const lineHeight = Math.ceil((size * target) / GRID_UNIT) * GRID_UNIT;
    return [
      name,
      {
        size: Number(size.toFixed(2)),
        leading: Number((lineHeight / size).toFixed(4)),
      },
    ];
  }),
) as Record<TypeStep, { size: number; leading: number }>;

/** One step down from whatever surrounds it, as a relative size. */
export const STEP_DOWN_EM = `${Number((1 / TYPE_RATIO).toFixed(4))}em`;

const rem = (px: number) => `${Number((px / 16).toFixed(4))}rem`;

export const scaleTokens: Record<string, string> = {
  /** Square. */
  radius: '0px',
  'duration-fast': '100ms',
  'duration-base': '150ms',
  'ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'font-sans':
    "'Hanken Grotesk Variable', ui-sans-serif, system-ui, sans-serif",
  ...Object.fromEntries(
    TYPE_STEPS.flatMap(name => [
      [`text-${name}`, rem(typeScale[name].size)],
      [`leading-${name}`, String(typeScale[name].leading)],
    ]),
  ),
};
