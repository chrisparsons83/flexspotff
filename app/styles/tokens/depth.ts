/**
 * Depth: how surfaces stand off the page (see #220). Modelled on Brackt's
 * restraint rather than on shadow:
 *
 * - The page is dark. The nav and footer are solid in the page colour,
 *   behind a hairline, rather than a bar of their own.
 * - A card is one step lighter than the page with a 1px translucent edge.
 *   No shadow, and its title sits on the card rather than on a band.
 * - One gradient, the logo orange into red. It fills the primary button and
 *   underlines the current tab. Never a large area, never text.
 * - Buttons are flat: the gradient primary, and an outlined secondary.
 * - The current section is marked by the accent, not by a block.
 * - The nav and tab labels are Archivo Narrow, in sentence case.
 * - Glow only where something asks for it by name, such as a live game.
 * - Some interest behind the top of the page: a deep field-green glow and
 *   faint hash marks and yard lines, both fading out before the content
 *   gets busy.
 *
 * Every value is a knob, so the Storybook depth playground can turn each one
 * and show the result in both themes before it is fixed here. The knobs also
 * reach back to the flat look the site had before, for comparison.
 */
import type { Theme } from './palette';

export type Depth = {
  /** Opacity of the 1px edge around cards and outlined buttons, 0 to 1. */
  hairline: number;
  /** Opacity of a lighter line along a card's top edge, 0 to 1. */
  lift: number;
  /** Strength of a soft shadow under cards, 0 to 1. */
  shadow: number;
  /** Card headers as a band of the secondary surface, not on the card. */
  headerBand: boolean;
  /** Share of red the header band warms toward at its end, 0 to 100. */
  warmth: number;
  /** The nav and footer on the page colour rather than a card-coloured bar. */
  chromeOnPage: boolean;
  /** Height in px of the gradient bar under the current nav section. */
  navBar: number;
  /** The current tab as an underlined label, or as an accent block. */
  tabs: 'underline' | 'block';
  /** The primary button filled with the gradient rather than flat orange. */
  gradientButton: boolean;
  /** How far buttons sit up on a solid drop, in px; 0 is flat. */
  pressDrop: number;
  /** Secondary buttons outlined on the surface rather than filled. */
  outlineSecondary: boolean;
  /** Strength of the orange halo on what asks for it, 0 to 1.5. */
  glow: number;
  /**
   * The glow's shape: a soft ellipse, a straight wash down from the top, or
   * a narrow beam of orange inside a wider haze of red.
   */
  glowShape: 'radial' | 'wash' | 'beam';
  /**
   * The glow's colour: the logo orange, the gradient's red, deep red, or a
   * deep field green.
   */
  glowTone: 'orange' | 'red' | 'deep' | 'green';
  /** Share of the accent at the top of the page glow, 0 to 100. */
  pageGlow: number;
  /** How far down the page glow reaches, in px. */
  pageGlowReach: number;
  /** A faint pattern behind the top of the page. */
  texture: 'none' | 'hashes' | 'field' | 'dots' | 'grid' | 'lines' | 'diagonal';
  /** Opacity of the pattern, 0 to 0.3. */
  textureStrength: number;
  /** How far down the pattern reaches before it fades out, in px. */
  textureReach: number;
  /** Opacity of a position's colour on a draft cell, 0 to 1. */
  positionTint: number;
  /** How much darker a table's well is than what it sits on, 0 to 100. */
  well: number;
  /** Control labels in tracked capitals rather than sentence case. */
  capitalLabels: boolean;
  /** Width of the nav and tab labels, as a percentage of normal. */
  labelWidth: number;
  /** Page title width, as a percentage of normal (Archivo runs 62 to 125). */
  titleWidth: number;
  /** Page title weight, 100 to 900. */
  titleWeight: number;
  /** The narrow width dense views use, such as the draft board. */
  narrowWidth: number;
  /** Corner radius in px. Square is the rule; this is for trying. */
  radius: number;
};

export const DEFAULT_DEPTH: Depth = {
  hairline: 0.1,
  lift: 0,
  shadow: 0,
  headerBand: false,
  warmth: 0,
  chromeOnPage: true,
  navBar: 0,
  tabs: 'underline',
  gradientButton: true,
  pressDrop: 0,
  outlineSecondary: true,
  glow: 0.6,
  glowShape: 'beam',
  glowTone: 'green',
  pageGlow: 40,
  pageGlowReach: 480,
  texture: 'field',
  textureStrength: 0.05,
  textureReach: 560,
  positionTint: 0.22,
  well: 0,
  capitalLabels: false,
  labelWidth: 77.5,
  titleWidth: 100,
  titleWeight: 800,
  narrowWidth: 75,
  radius: 0,
};

/** The site before #220, near enough, for comparison. */
export const FLAT_DEPTH: Depth = {
  ...DEFAULT_DEPTH,
  hairline: 0,
  headerBand: true,
  chromeOnPage: false,
  navBar: 3,
  tabs: 'block',
  gradientButton: false,
  pressDrop: 3,
  outlineSecondary: false,
  glowShape: 'radial',
  glowTone: 'orange',
  pageGlow: 32,
  pageGlowReach: 680,
  texture: 'none',
  positionTint: 0.3,
  capitalLabels: false,
  labelWidth: 100,
};

/**
 * What light and dark do differently: on a dark page the edge and the top
 * line are white and the shadow is deep; on a light page the edge is dark,
 * the top line is near white, and the shadow is lighter and tinged with the
 * ground's hue so it does not read as dirt.
 */
const THEMED = {
  dark: {
    edge: '1 0 0',
    drop: '0 0 0',
    dropScale: 1,
    liftScale: 1,
    glowScale: 1,
  },
  // Orange on a near-white page reads as peach long before it reads as a
  // glow, so the light page takes less of it.
  light: {
    edge: '0 0 0',
    drop: '0.205 0.015 268',
    dropScale: 0.4,
    liftScale: 8,
    glowScale: 0.5,
  },
} as const;

/**
 * A dash at the top left of a tile: a conic gradient fills only the quarter
 * above and left of its centre, so with the centre at (width, height) it
 * draws a block that size.
 */
const dash = (ink: string, width: number, height: number) =>
  `conic-gradient(at ${width}px ${height}px, transparent 75%, ${ink} 0)`;

/**
 * Hash marks laid out like a field: a column down the middle and one out
 * toward each side, a dash every yard, and (for `field`) a yard line across
 * the page every five yards. The columns are set in percentages, so they
 * close in with the screen and still read on a phone.
 */
const HASH = {
  width: 24,
  height: 2,
  /** One yard. */
  down: 18,
  /** Each column's centre, from the middle of the page. */
  columns: ['-36%', '0%', '36%'],
};

/** The hash columns as layers, each a dash tiled down one column only. */
const hashLayers = (ink: string) => ({
  image: HASH.columns.map(() => dash(ink, HASH.width, HASH.height)),
  size: HASH.columns.map(() => `${HASH.width}px ${HASH.down}px`),
  position: HASH.columns.map(x => `calc(50% + ${x} - ${HASH.width / 2}px) 0`),
  repeat: HASH.columns.map(() => 'repeat-y'),
});

/**
 * Each pattern as background layers, drawn in `ink`: the images, and each
 * layer's tile size, position and repeat.
 */
const textures = (ink: string) => {
  const hashes = hashLayers(ink);
  const layers = (layer: {
    image: string[];
    size: string[];
    position?: string[];
    repeat?: string[];
  }) => ({
    image: layer.image.join(', '),
    size: layer.size.join(', '),
    position: (layer.position ?? layer.image.map(() => '50% 0')).join(', '),
    repeat: (layer.repeat ?? layer.image.map(() => 'repeat')).join(', '),
  });
  const one = (image: string, size: string) =>
    layers({ image: [image], size: [size] });
  return {
    none: one('none', 'auto'),
    hashes: layers(hashes),
    field: layers({
      image: [...hashes.image, `linear-gradient(${ink} 1px, transparent 1px)`],
      size: [...hashes.size, `100% ${HASH.down * 5}px`],
      position: [...hashes.position, '50% 0'],
      repeat: [...hashes.repeat, 'repeat'],
    }),
    dots: one(
      `radial-gradient(circle, ${ink} 1px, transparent 1.5px)`,
      '22px 22px',
    ),
    grid: layers({
      image: [
        `linear-gradient(${ink} 1px, transparent 1px)`,
        `linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
      ],
      size: ['48px 48px', '48px 48px'],
    }),
    // Like yard lines: a rule across the page every few rows.
    lines: one(`linear-gradient(${ink} 1px, transparent 1px)`, '100% 56px'),
    diagonal: one(
      `repeating-linear-gradient(135deg, ${ink} 0 1px, transparent 1px 14px)`,
      'auto',
    ),
  };
};

/** The page glow in each shape, from `share`% of the accent at the top. */
/** The glow's colours: its centre, and the wider haze of the beam. */
const GLOW_TONES = {
  orange: ['primary', 'primary-red'],
  red: ['primary-red', 'primary-deep'],
  deep: ['primary-deep', 'primary-deep'],
  green: ['field-green', 'field-green'],
} as const;

const glows = (share: number, reach: number, tone: Depth['glowTone']) => {
  const [centre, haze] = GLOW_TONES[tone];
  return {
    radial: `radial-gradient(90% ${reach}px at 50% 0, ${mix(
      centre,
      share,
      'background',
    )}, transparent)`,
    wash: `linear-gradient(180deg, ${mix(
      centre,
      share,
      'background',
    )}, transparent ${reach}px)`,
    beam: [
      `radial-gradient(36% ${reach * 0.7}px at 50% 0, ${mix(
        centre,
        share,
        'background',
      )}, transparent)`,
      `radial-gradient(100% ${reach}px at 50% 0, ${mix(
        haze,
        share * 0.6,
        'background',
      )}, transparent)`,
    ].join(', '),
  };
};

/** Mixes `share`% of a token's colour into another's, in OKLab. */
const mix = (token: string, share: number, into: string) =>
  `color-mix(in oklab, oklch(var(--${token})) ${share}%, oklch(var(--${into})))`;

const fixed = (value: number) => Number(value.toFixed(3));

/**
 * The depth tokens for a theme, as CSS custom properties. Each theme block
 * declares all of them, because a custom property that reads another is
 * worked out where it is declared: one set on :root would keep the dark
 * colours inside a `light` block.
 */
export const depthTokens = (
  theme: Theme,
  depth: Depth = DEFAULT_DEPTH,
): Record<string, string> => {
  const { edge, drop, dropScale, liftScale, glowScale } = THEMED[theme];
  const texture = textures(
    `oklch(var(--foreground) / ${fixed(depth.textureStrength)})`,
  )[depth.texture];
  const shadow = depth.shadow * dropScale;
  const halo = (alpha: number) =>
    `oklch(var(--primary) / ${fixed(alpha * depth.glow)})`;
  const block = depth.tabs === 'block';

  return {
    radius: `${depth.radius}px`,
    hairline: `oklch(${edge} / ${depth.hairline})`,
    'card-shadow': [
      `inset 0 0 0 1px oklch(${edge} / ${depth.hairline})`,
      `inset 0 1px 0 0 oklch(1 0 0 / ${fixed(depth.lift * liftScale)})`,
      `0 1px 2px 0 oklch(${drop} / ${fixed(shadow * 0.5)})`,
      `0 12px 32px -12px oklch(${drop} / ${fixed(shadow)})`,
    ].join(', '),
    'header-bg': depth.headerBand ? 'oklch(var(--secondary))' : 'transparent',
    'header-fill': depth.headerBand
      ? `linear-gradient(90deg, oklch(var(--secondary)) 40%, ${mix(
          'primary-red',
          depth.warmth,
          'secondary',
        )})`
      : 'none',
    // On a band the title sits in the band's middle; on the card it sits
    // at the content's inset, with the content straight under it.
    'header-pad-top': depth.headerBand ? '0.75rem' : '1.25rem',
    'header-pad-bottom': depth.headerBand ? '0.75rem' : '0',
    // Solid either way, so the glow and texture start under the nav and
    // stop above the footer.
    'chrome-bg': depth.chromeOnPage
      ? 'oklch(var(--background))'
      : 'oklch(var(--card))',
    'accent-gradient':
      'linear-gradient(90deg, oklch(var(--primary)), oklch(var(--primary-red)))',
    'nav-bar': `${depth.navBar}px`,
    'tab-bg': block ? 'oklch(var(--primary))' : 'transparent',
    'tab-fg': block
      ? 'oklch(var(--primary-foreground))'
      : 'oklch(var(--foreground))',
    'tab-edge': block ? 'oklch(var(--primary-edge))' : 'transparent',
    'tab-bar': block ? '0px' : '3px',
    'primary-fill': depth.gradientButton
      ? 'linear-gradient(180deg, oklch(var(--primary)), oklch(var(--primary-red)))'
      : 'none',
    'press-drop': `${depth.pressDrop}px`,
    'secondary-bg': depth.outlineSecondary
      ? 'transparent'
      : 'oklch(var(--secondary))',
    'secondary-edge': depth.outlineSecondary
      ? `oklch(${edge} / ${fixed(Math.max(depth.hairline * 1.6, 0.16))})`
      : 'transparent',
    glow: `0 0 0 1px ${halo(0.5)}, 0 0 20px 0 ${halo(0.45)}`,
    'page-glow': glows(
      fixed(depth.pageGlow * glowScale),
      depth.pageGlowReach,
      depth.glowTone,
    )[depth.glowShape],
    'page-texture': texture.image,
    'page-texture-size': texture.size,
    'page-texture-position': texture.position,
    'page-texture-repeat': texture.repeat,
    'page-texture-reach': `${depth.textureReach}px`,
    'position-tint': String(depth.positionTint),
    // A share of black, read by the table where it knows what it sits on.
    'well-mix': `oklch(0 0 0) ${
      theme === 'dark' ? depth.well : depth.well / 4
    }%`,
    'label-case': depth.capitalLabels ? 'uppercase' : 'none',
    'label-tracking': depth.capitalLabels ? '0.05em' : 'normal',
    'label-width': `${depth.labelWidth}%`,
    'title-width': `${depth.titleWidth}%`,
    'title-weight': String(depth.titleWeight),
    'width-narrow': `${depth.narrowWidth}%`,
  };
};
