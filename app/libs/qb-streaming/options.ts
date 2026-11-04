/**
 * Shared rules for QB Streaming options: which game a QB plays in, how their
 * matchup reads, and whether a hidden option still shows. Kept here so the
 * sync, the admin week page and the entry page can't drift apart.
 */

type TeamGame = { homeTeamId: string; awayTeamId: string };

/** The game a team plays in, out of one week's games. */
export const gameForTeam = <G extends TeamGame>(
  games: G[],
  teamId: string | null,
) =>
  teamId
    ? games.find(
        game => game.homeTeamId === teamId || game.awayTeamId === teamId,
      )
    : undefined;

type MatchupGame<T> = { homeTeamId: string; homeTeam: T; awayTeam: T };

/**
 * A QB's side of their game, for building a matchup line in whatever form the
 * page wants: "vs" with the away team when they are at home, "at" with the home
 * team when they are away.
 */
export function matchupFor<T>(teamId: string | null, game: MatchupGame<T>) {
  const isHome = teamId === game.homeTeamId;
  return {
    team: isHome ? game.homeTeam : game.awayTeam,
    opponent: isHome ? game.awayTeam : game.homeTeam,
    word: isHome ? 'vs' : 'at',
  } as const;
}

/** An option still on the week, not hidden by the sync or an admin. */
export const isListed = (option: { removedAt: Date | null }) =>
  !option.removedAt;

/**
 * Whether a member can see and keep an option: it is listed, or it is already
 * their pick, which stays theirs even after the QB is hidden.
 */
export const isAvailableTo = (
  option: { id: string; removedAt: Date | null },
  currentPickId: string | null | undefined,
) => isListed(option) || option.id === currentPickId;
