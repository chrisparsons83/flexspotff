/**
 * The focus ring every control shares: a solid outline in the ring colour,
 * set off from the control so it shows on any surface. Square, like
 * everything else.
 */
export const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * Overlays (dialogs, menus, popovers, tooltips) are the only surfaces with a
 * shadow. They fade in and out with their state and do not move or grow.
 */
export const OVERLAY =
  'bg-popover text-popover-foreground shadow-overlay duration-fast data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0';

/**
 * The words on a control (nav, tabs, buttons, table headers), in tracked
 * capitals or sentence case as the depth tokens say. Headings and copy keep
 * their case.
 */
export const LABEL =
  '[letter-spacing:var(--label-tracking)] [text-transform:var(--label-case)]';

/**
 * The nav and tab labels: LABEL, in Archivo at the width the depth tokens
 * give them (narrow, by default), so a row of sections reads as one strip.
 */
export const NAV_LABEL = `${LABEL} [font-stretch:var(--label-width)]`;

/** The edge of a text field, select or other control you type or pick in. */
export const CONTROL =
  'border border-input bg-background text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-negative disabled:cursor-not-allowed disabled:opacity-50';
