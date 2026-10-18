/**
 * The current season is linked from the nav before it has any data, so it
 * shows an empty page. Any other year with no data is a 404.
 *
 * @throws a 404 `Response` when `year` has no data and is not the current
 *   season
 */
export function assertSeasonHasDataOrIsCurrent(
  year: number,
  hasData: boolean,
  currentSeasonYear: number | undefined,
  notFoundMessage: string,
): void {
  if (!hasData && year !== currentSeasonYear) {
    throw new Response(notFoundMessage, { status: 404 });
  }
}

/**
 * The "Weekly Standings" nav link for a game, or nothing when the season has
 * no week to link to yet.
 *
 * @param basePath - the game's standings path, e.g. `/games/spread-pool/standings`
 */
export function weeklyStandingsLink(
  basePath: string,
  year: number,
  week: number | undefined,
) {
  return week === undefined
    ? []
    : [
        {
          name: 'Weekly Standings',
          href: `${basePath}/${year}/${week}`,
          current: false,
        },
      ];
}
