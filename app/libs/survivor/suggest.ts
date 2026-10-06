import { normalizeName } from '~/utils/names';

// As in namesLookAlike: shorter handles turn up inside too many other names.
const MIN_HANDLE_LENGTH = 4;

/**
 * The member a Yahoo entry probably belongs to, from the handles members go
 * by on Sleeper. Yahoo nicknames are mostly first names ("Kevin"), but the
 * pick sets are often named after the Sleeper handle ("CodeMonkey's
 * Survival"), so any name of the entry that contains a matched handle points
 * at that member.
 *
 * Only a single candidate is suggested: with two there is no telling which,
 * and a wrong suggestion is worse than none.
 *
 * @returns the member's ID, or '' for no suggestion.
 */
export function suggestFromSleeperHandles(
  names: (string | null)[],
  handles: { displayName: string; userId: string }[],
): string {
  const keys = names.flatMap(name => (name ? [normalizeName(name)] : []));
  const candidates = new Set(
    handles
      .filter(handle => {
        const key = normalizeName(handle.displayName);
        return (
          key.length >= MIN_HANDLE_LENGTH &&
          keys.some(name => name.includes(key))
        );
      })
      .map(handle => handle.userId),
  );
  return candidates.size === 1 ? [...candidates][0] : '';
}
