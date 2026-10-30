/**
 * Colour maths for the design tokens: OKLCH, sRGB and WCAG contrast.
 *
 * The palette is defined in OKLCH because equal steps in its lightness and
 * hue look like equal steps, which is what a generated progression needs.
 * The OKLab matrices are Björn Ottosson's reference values.
 */

export type Oklch = { l: number; c: number; h: number };

type Rgb = [number, number, number];

const srgbToLinear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

const linearToSrgb = (v: number) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;

const linearRgbToOklch = ([r, g, b]: Rgb): Oklch => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  const h = c < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
};

const oklchToLinearRgb = ({ l: L, c, h }: Oklch): Rgb => {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

export const hexToOklch = (hex: string): Oklch => {
  const digits = hex.replace('#', '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(digits)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }
  const full =
    digits.length === 3 ? [...digits].map(d => d + d).join('') : digits;
  const n = parseInt(full, 16);
  const rgb = [n >> 16, (n >> 8) & 0xff, n & 0xff].map(v =>
    srgbToLinear(v / 255),
  ) as Rgb;
  return linearRgbToOklch(rgb);
};

const EPSILON = 1e-4;

export const inGamut = (color: Oklch) =>
  oklchToLinearRgb(color).every(v => v >= -EPSILON && v <= 1 + EPSILON);

export const oklchToHex = (color: Oklch) =>
  '#' +
  oklchToLinearRgb(color)
    .map(v => Math.round(linearToSrgb(Math.min(1, Math.max(0, v))) * 255))
    .map(v => v.toString(16).padStart(2, '0'))
    .join('');

/**
 * Brings a colour into sRGB by lowering its chroma, keeping lightness and hue.
 * Lightness is what the contrast rules depend on, so it is the one to keep.
 */
export const toGamut = (color: Oklch): Oklch => {
  if (inGamut(color)) return color;
  let low = 0;
  let high = color.c;
  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    if (inGamut({ ...color, c: mid })) low = mid;
    else high = mid;
  }
  return { ...color, c: low };
};

/** WCAG 2 relative luminance. */
export const luminance = (color: Oklch) => {
  const [r, g, b] = oklchToLinearRgb(color).map(v =>
    Math.min(1, Math.max(0, v)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2 contrast ratio, 1 to 21. */
export const contrast = (a: Oklch, b: Oklch) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Euclidean distance in OKLab: how different two colours look. */
export const distance = (a: Oklch, b: Oklch) => {
  const toLab = ({ l, c, h }: Oklch) => [
    l,
    c * Math.cos((h * Math.PI) / 180),
    c * Math.sin((h * Math.PI) / 180),
  ];
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

/**
 * Rounds to the precision written into CSS. Four decimals on lightness and
 * chroma keep every fixed hex colour exact after the round trip.
 */
export const round = ({ l, c, h }: Oklch): Oklch => ({
  l: Number(l.toFixed(4)),
  c: Number(c.toFixed(4)),
  h: Number(h.toFixed(2)),
});
