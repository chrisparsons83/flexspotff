// Sleeper names and Discord names rarely match byte for byte, but they very
// often match once punctuation and casing are out of the way.
export const normalizeName = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

// Short fragments match far too much to be worth suggesting - "al" turns up
// inside half the names on the server.
const MIN_CONTAINMENT_LENGTH = 4;

/**
 * Whether two names look like the same person once normalized. Containment
 * matters as much as equality here: members routinely register as "Panda" one
 * season and "pandabair" the next, and an equality-only check misses every one
 * of those.
 */
export const namesLookAlike = (a: string, b: string) => {
  const left = normalizeName(a);
  const right = normalizeName(b);

  // A name that is all emoji or all punctuation normalizes away to nothing,
  // and nothing is not a name that matches anybody.
  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const [shorter, longer] =
    left.length <= right.length ? [left, right] : [right, left];

  return shorter.length >= MIN_CONTAINMENT_LENGTH && longer.includes(shorter);
};
