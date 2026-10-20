/* eslint-disable no-unused-vars */
/**
 * The "Patterns we do not use" from #189 that can be read off a rendered
 * page. Runs in the browser: check-storybook.ts sends this file to the page
 * as source and calls findPatterns() there, so it must not import or close
 * over anything.
 *
 * Returns one line per finding. The rest of the list (an icon beside every
 * heading, walls of stat tiles, three-up feature grids, motion on load)
 * needs a person; the review checklist in Storybook covers those.
 */
function findPatterns() {
  /** @type {string[]} */
  const findings = [];

  // Storybook's own furniture is not ours to check.
  /** @param {Element} el */
  const ours = el =>
    !el.closest(
      '#storybook-docs, .sb-wrapper, .sb-preparing-story, .sb-preparing-docs, .sb-errordisplay, .sb-nopreview',
    );

  /** @param {Element} el */
  const describe = el => {
    const text = (el.textContent ?? '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 40);
    const id = el.id ? `#${el.id}` : '';
    return `<${el.tagName.toLowerCase()}${id}> "${text}"`;
  };

  /** @param {string} rule @param {Element} el */
  const add = (rule, el) => findings.push(`${rule}: ${describe(el)}`);

  /**
   * Whether the element's value for `property` is exactly one of the depth
   * tokens, worked out where the element is so it reads the same theme. A
   * probe inside it takes each token in turn and the computed values are
   * compared, so `var(--glow)` passes and a hand-written halo does not.
   * @param {Element} el @param {'boxShadow' | 'backgroundImage'} property
   * @param {string[]} tokens
   */
  const fromToken = (el, property, tokens) => {
    // Tailwind pads a shadow with empty ring layers; they draw nothing.
    /** @param {string} value */
    const drawn = value =>
      value
        .split(/,(?![^(]*\))/)
        .map(layer => layer.trim())
        .filter(layer => !/^rgba\(0, 0, 0, 0\) 0px 0px( 0px)*$/.test(layer))
        .join(', ');
    const probe = document.createElement('span');
    el.appendChild(probe);
    const actual = drawn(getComputedStyle(el)[property]);
    const match = tokens.some(token => {
      probe.style[property] = `var(--${token})`;
      return drawn(getComputedStyle(probe)[property]) === actual;
    });
    probe.remove();
    return match;
  };

  // Copy: separators, emoji, em dashes, exclamation marks, stock phrases.
  /** @type {[string, RegExp][]} */
  const COPY = [
    ['dot, bullet or pipe as a separator', /\s[·•|]\s|^[·•|]$/],
    ['emoji', /\p{Extended_Pictographic}/u],
    ['em dash', /—/],
    ['exclamation mark', /!(\s|$)/],
    ['stock phrase', /\b(Oops|Welcome back|Let['’]s|Nothing to see here)\b/i],
  ];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || !ours(parent)) continue;
    if (parent.closest('script, style, code, pre')) continue;
    const text = node.textContent ?? '';
    for (const [rule, pattern] of COPY) {
      if (pattern.test(text)) add(rule, parent);
    }
  }

  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    if (!ours(el) || el.closest('svg')) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none') continue;

    // Square corners everywhere.
    const radii = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomLeftRadius,
      style.borderBottomRightRadius,
    ];
    if (radii.some(radius => parseFloat(radius) > 0)) {
      add('rounded corner', el);
    }

    // Shadows on buttons (their drop) and overlays, and otherwise only the
    // depth tokens' card shadows and glow.
    if (style.boxShadow !== 'none') {
      const allowed =
        el.closest(
          'button, [data-slot="button"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"], [data-radix-popper-content-wrapper]',
        ) || fromToken(el, 'boxShadow', ['card-shadow', 'card-glow', 'glow']);
      if (!allowed) add('shadow', el);
    }

    // Gradients only from the depth tokens: the page glow, the accent bar,
    // the primary button's fill, and the warmth in card headers.
    if (
      style.backgroundImage.includes('gradient') &&
      !el.hasAttribute('data-page-glow') &&
      !fromToken(el, 'backgroundImage', [
        'accent-gradient',
        'primary-fill',
        'header-fill',
      ])
    ) {
      add('gradient', el);
    }
    if (style.backgroundClip === 'text') add('gradient text', el);

    if (style.backdropFilter && style.backdropFilter !== 'none') {
      add('backdrop blur', el);
    }

    // Eyebrows: small uppercase text with wide tracking. Tracked capitals
    // are for the labels on controls only.
    if (
      style.textTransform === 'uppercase' &&
      parseFloat(style.letterSpacing) > 0 &&
      !el.closest(
        'nav a, nav button, button, [data-slot="button"], thead, [role="tab"]',
      )
    ) {
      add('uppercase eyebrow', el);
    }

    // Accent strips down the left of a card or callout.
    const left = parseFloat(style.borderLeftWidth);
    if (
      left >= 2 &&
      parseFloat(style.borderTopWidth) === 0 &&
      parseFloat(style.borderRightWidth) === 0
    ) {
      add('left accent strip', el);
    }
  }

  return Array.from(new Set(findings));
}
