/**
 * Turns raw player/schedule/score rows into the decorated list the DFS Survivor
 * entry picker renders. Kept out of the route loader so the join rules - which
 * are where the old UI got its matchups wrong - can be tested directly.
 */

/** One selectable player, with everything the picker table shows. */
export type PickerPlayer = {
  id: string;
  name: string;
  position: string;
  teamAbbr: string;
  /** null when the player's team is on bye this week. */
  opponentAbbr: string | null;
  isHome: boolean;
  projection: number | null;
  seasonPoints: number;
  /** The week this player is already used in, if any. */
  usedInWeek: number | null;
  /** What they scored that week, or null if it hasn't been scored yet. */
  usedPoints: number | null;
  /** Their game has kicked off, so they can no longer be picked. */
  isLocked: boolean;
};

export type PickerPlayerInput = {
  id: string;
  fullName: string;
  position: string | null;
  currentNFLTeamId: string | null;
  currentNFLTeam: { id: string; sleeperId: string } | null;
};

export type PickerGameInput = {
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: { sleeperId: string };
  awayTeam: { sleeperId: string };
  gameStartTime: Date;
};

export type PlayerUsage = {
  week: number;
  points: number;
  /** Until the week is scored, `points` is a placeholder zero, not a result. */
  isScored: boolean;
};

export function decoratePickerPlayers({
  players,
  games,
  projections,
  seasonTotals,
  usage,
  currentTime,
}: {
  players: PickerPlayerInput[];
  games: PickerGameInput[];
  projections: Map<string, number>;
  seasonTotals: Map<string, number>;
  usage: Map<string, PlayerUsage>;
  currentTime: Date;
}): PickerPlayer[] {
  // Join on the team FK rather than the denormalised `nflTeam` abbreviation, so
  // a traded player gets the opponent their current team actually plays.
  const gameByTeamId = new Map<string, PickerGameInput>();
  for (const game of games) {
    gameByTeamId.set(game.homeTeamId, game);
    gameByTeamId.set(game.awayTeamId, game);
  }

  return players.map(player => {
    const game = player.currentNFLTeamId
      ? gameByTeamId.get(player.currentNFLTeamId)
      : undefined;
    const isHome = !!game && game.homeTeamId === player.currentNFLTeamId;
    const opponent = game ? (isHome ? game.awayTeam : game.homeTeam) : null;
    const used = usage.get(player.id);

    return {
      id: player.id,
      // Defenses have always been shown as the team abbreviation.
      name:
        player.position === 'DEF'
          ? player.currentNFLTeam?.sleeperId ?? player.fullName
          : player.fullName,
      position: player.position ?? '',
      teamAbbr: player.currentNFLTeam?.sleeperId ?? '',
      opponentAbbr: opponent?.sleeperId ?? null,
      isHome,
      projection: projections.get(player.id) ?? null,
      seasonPoints: seasonTotals.get(player.id) ?? 0,
      usedInWeek: used?.week ?? null,
      usedPoints: used?.isScored ? used.points : null,
      isLocked: game ? game.gameStartTime <= currentTime : false,
    };
  });
}
