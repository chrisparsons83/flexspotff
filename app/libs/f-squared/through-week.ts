type TeamTotals = {
  pointsFor: number;
  games: { week: number; pointsScored: number }[];
};

/**
 * The last week counted in F² totals. They add up each team's `pointsFor`,
 * which only moves when the league sync runs and stops at the end of the
 * regular season, so it can trail the live weekly scores by a week or more.
 *
 * Read from the totals rather than the calendar: it is the week whose running
 * game scores land closest to `pointsFor`. Closest rather than equal, since a
 * stat correction can leave the two slightly apart.
 *
 * @returns null before any points are counted.
 */
export function fSquaredThroughWeek(teams: TeamTotals[]): number | null {
  if (!teams.some(team => team.pointsFor > 0)) return null;

  const weeks = [
    ...new Set(teams.flatMap(team => team.games.map(game => game.week))),
  ].sort((a, b) => a - b);

  let closest: { week: number; gap: number } | null = null;
  for (const week of weeks) {
    const gap = teams.reduce((sum, team) => {
      const scored = team.games
        .filter(game => game.week <= week)
        .reduce((total, game) => total + game.pointsScored, 0);
      return sum + Math.abs(scored - team.pointsFor);
    }, 0);
    // Strictly closer, so unplayed weeks scoring 0 never move it forward.
    if (!closest || gap < closest.gap) closest = { week, gap };
  }
  return closest?.week ?? null;
}
