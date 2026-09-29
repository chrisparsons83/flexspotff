import { createMemberSuggester, normalizeName } from '~/utils/names';

/**
 * The names people went by in the old Google Sheets, grouped so each person is
 * matched to a member once. Shared by every sheet import; the matches
 * themselves are saved as `MemberAlias` rows.
 */

export type SheetMember = { id: string; discordName: string };

export type SheetName = {
  /** normalizeName of the spelling - how aliases are stored. */
  alias: string;
  /** Every spelling in the sheet that normalizes to `alias`. */
  spellings: string[];
  /** How many rows of the sheet carry the name. */
  picks: number;
  member: SheetMember | null;
};

/** Groups a sheet's names by alias, sorted, with whoever each is matched to. */
export function groupSheetNames(
  names: string[],
  memberFor: (alias: string) => SheetMember | null,
): SheetName[] {
  const byAlias = new Map<string, SheetName>();
  for (const name of names) {
    const alias = normalizeName(name);
    const sheetName = byAlias.get(alias) ?? {
      alias,
      spellings: [],
      picks: 0,
      member: memberFor(alias),
    };
    if (!sheetName.spellings.includes(name)) {
      sheetName.spellings.push(name);
    }
    sheetName.picks++;
    byAlias.set(alias, sheetName);
  }

  return [...byAlias.values()].sort((a, b) => a.alias.localeCompare(b.alias));
}

/** The blocking message for names still waiting on a match, if any are. */
export function unmatchedNamesMessage(names: SheetName[]): string | null {
  const unmatched = names.filter(name => !name.member).length;
  if (unmatched === 0) return null;

  return `${unmatched} sheet name${
    unmatched === 1 ? ' is' : 's are'
  } not matched to a member yet.`;
}

/**
 * Pre-selects a member for each unmatched name. An import that knows better -
 * say, from who managed a team the sheet names the same way - passes its own
 * `suggestions` by alias, which win. Otherwise it is the member whose name
 * looks like the sheet's, where exactly one does. Old sheets are full of names
 * like "Klay" for "klaystation", so this looks past exact matches.
 */
export function withSuggestions(
  names: SheetName[],
  members: SheetMember[],
  suggestions: Record<string, string> = {},
) {
  const suggest = createMemberSuggester(members, { lookAlike: true });
  // Only live members are offered, so a suggestion of anyone else is dropped.
  const memberIds = new Set(members.map(member => member.id));

  return names.map(name => {
    if (name.member) return { ...name, suggestedMemberId: '' };

    const known = suggestions[name.alias];
    return {
      ...name,
      suggestedMemberId:
        known && memberIds.has(known) ? known : suggest(...name.spellings),
    };
  });
}
