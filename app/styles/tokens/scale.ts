/**
 * Tokens that are not colours. Corners are near-square and set once here.
 * Motion is for state changes only, so there are two short durations and
 * one easing curve.
 *
 * Spacing and the layout grid use Tailwind's 4px scale and its grid columns
 * as they stand; they are already one systematic scale.
 */
export const scaleTokens: Record<string, string> = {
  radius: '2px',
  'duration-fast': '100ms',
  'duration-base': '150ms',
  'ease-standard': 'cubic-bezier(0.2, 0, 0, 1)',
};
