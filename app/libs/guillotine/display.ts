/**
 * How a guillotine team is named on the site: the member it belongs to, or
 * the Sleeper name for an account nobody has matched yet.
 */
export type TeamIdentity = {
  rosterId: number;
  sleeperDisplayName: string | null;
  user: {
    id: string;
    discordName: string;
    discordUsername: string | null;
  } | null;
};

export const teamName = (team: TeamIdentity) =>
  team.user?.discordName ?? team.sleeperDisplayName ?? `Team ${team.rosterId}`;

export const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};

export const pts = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : value.toFixed(digits);

/**
 * Which of the two guillotine leagues this is. The buy-in league has always had
 * "Business" in its name; every other one, 2021's included, was free.
 */
export const leagueKind = (leagueName: string) =>
  /business/i.test(leagueName) ? ('Buy-in' as const) : ('Free' as const);
