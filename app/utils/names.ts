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

type SuggestableMember = { id: string; discordName: string };

/**
 * Builds a lookup that suggests the member a name probably belongs to. A name
 * only suggests someone when exactly one member matches - with two candidates
 * there is no telling which of them it is, and a wrong suggestion is worse
 * than none.
 *
 * `lookAlike` falls back to `namesLookAlike` when nobody matches exactly. Old
 * spreadsheets are full of names like "Klay" for "klaystation", but the
 * fallback is looser, so it is opt-in.
 */
export const createMemberSuggester = (
  members: SuggestableMember[],
  { lookAlike = false }: { lookAlike?: boolean } = {},
) => {
  const memberIdsByName = new Map<string, string[]>();
  for (const member of members) {
    const key = normalizeName(member.discordName);
    // A name that is all emoji or all punctuation normalizes away to nothing,
    // and nothing is not a name that matches anybody.
    if (!key) {
      continue;
    }
    memberIdsByName.set(key, [...(memberIdsByName.get(key) ?? []), member.id]);
  }

  return (...names: (string | null)[]) => {
    for (const name of names) {
      const key = name ? normalizeName(name) : '';
      const matches = key ? memberIdsByName.get(key) : undefined;
      if (matches?.length === 1) {
        return matches[0];
      }
    }

    if (lookAlike) {
      for (const name of names) {
        if (!name) continue;
        const matches = members.filter(member =>
          namesLookAlike(name, member.discordName),
        );
        if (matches.length === 1) {
          return matches[0].id;
        }
      }
    }

    return '';
  };
};
