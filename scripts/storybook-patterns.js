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

    // Shadows only on buttons (their drop) and overlays.
    if (style.boxShadow !== 'none') {
      const allowed = el.closest(
        'button, [data-slot="button"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"], [data-radix-popper-content-wrapper]',
      );
      if (!allowed) add('shadow', el);
    }

    // One gradient: the page glow.
    if (
      style.backgroundImage.includes('gradient') &&
      !el.hasAttribute('data-page-glow')
    ) {
      add('gradient', el);
    }
    if (style.backgroundClip === 'text') add('gradient text', el);

    if (style.backdropFilter && style.backdropFilter !== 'none') {
      add('backdrop blur', el);
    }

    // Eyebrows: small uppercase text with wide tracking.
    if (
      style.textTransform === 'uppercase' &&
      parseFloat(style.letterSpacing) > 0
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
