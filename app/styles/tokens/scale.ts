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
 * The six steps, smallest first, by the Tailwind name each one takes. Step 0
 * (`base`) is body text and tables; the steps above are headings.
 */
export const TYPE_STEPS = ['sm', 'base', 'lg', 'xl', '2xl', '3xl'] as const;
const BASE_INDEX = TYPE_STEPS.indexOf('base');

/** Text needs looser leading than headings. Both round up to the grid. */
const BODY_LEADING = 1.45;
const HEADING_LEADING = 1.2;

export type TypeStep = (typeof TYPE_STEPS)[number];

export const typeScale = Object.fromEntries(
  TYPE_STEPS.map((name, i) => {
    const size = TYPE_BASE * TYPE_RATIO ** (i - BASE_INDEX);
    const leading = i <= BASE_INDEX ? BODY_LEADING : HEADING_LEADING;
    const lineHeight = Math.ceil((size * leading) / GRID_UNIT) * GRID_UNIT;
    return [name, { size: Number(size.toFixed(2)), lineHeight }];
  }),
) as Record<TypeStep, { size: number; lineHeight: number }>;

const rem = (px: number) => `${Number((px / 16).toFixed(4))}rem`;

export const scaleTokens: Record<string, string> = {
  radius: '2px',
  'duration-fast': '100ms',
  'duration-base': '150ms',
  'ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
  'font-sans':
    "'Hanken Grotesk Variable', ui-sans-serif, system-ui, sans-serif",
  ...Object.fromEntries(
    TYPE_STEPS.flatMap(name => [
      [`text-${name}`, rem(typeScale[name].size)],
      [`leading-${name}`, rem(typeScale[name].lineHeight)],
    ]),
  ),
};
