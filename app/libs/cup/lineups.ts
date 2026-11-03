import type { GameState, StarterLine } from '~/libs/guillotine/projection';
import {
  gameProgress,
  projectStarter,
  projectTeam,
} from '~/libs/guillotine/projection';

/**
 * A cup team's lineups for the weeks of a round, and what those lineups were
 * or are projected to score.
 *
 * "Projected" is where the team is on course to finish: Sleeper's full
 * projection before kickoff, the points scored plus what is left of it while
 * games are on, and just the score once they are over.
 */

/** What is known about one NFL week, whichever team is being looked at. */
export type WeekFacts = {
  playerBySleeperId: Map<
    string,
    {
      id: string;
      fullName: string;
      position: string | null;
      nflTeam: string | null;
    }
  >;
  /** Sleeper's half-PPR projection by player ID, which is how the leagues score. */
  projectionByPlayerId: Map<string, number>;
  /** That week's game by NFL team abbreviation. A team with none is on bye. */
  gameByNflTeam: Map<string, { state: GameState; kickoff: Date }>;
};

export type LineupStarter = {
  sleeperId: string;
  name: string;
  position: string | null;
  points: number;
  projected: number | null;
  state: GameState | 'bye';
};

export type WeekLineup = {
  week: number;
  points: number;
  /** Null when no projections are stored for the week. */
  projected: number | null;
  /** Every starter's game is over. False for a team with no lineup yet. */
  finished: boolean;
  starters: LineupStarter[];
};

export type RoundTotal = {
  points: number;
  /** Null unless every week of the round has projections. */
  projected: number | null;
};

const round = (value: number) => Math.round(value * 100) / 100;

/** One team's lineup for one week, from its stored TeamGame. */
export function buildWeekLineup(
  teamGame: {
    week: number;
    pointsScored: number;
    starters: string[];
    startingPlayerPoints: number[];
  },
  { playerBySleeperId, projectionByPlayerId, gameByNflTeam }: WeekFacts,
  now: Date,
): WeekLineup {
  const lines = teamGame.starters.map((sleeperId, index) => {
    const player = playerBySleeperId.get(sleeperId);
    // A defense's Sleeper ID is its team abbreviation.
    const nflTeam = player?.nflTeam ?? (player ? null : sleeperId);
    const game = nflTeam ? gameByNflTeam.get(nflTeam) : undefined;
    const line: StarterLine = {
      sleeperId,
      points: teamGame.startingPlayerPoints[index] ?? 0,
      projection: player ? projectionByPlayerId.get(player.id) ?? 0 : 0,
      // No game this week is a bye, which is as finished as a final.
      progress: game
        ? gameProgress({ state: game.state, kickoff: game.kickoff, now })
        : 1,
    };
    return {
      line,
      name: sleeperId === '0' ? 'Empty' : player?.fullName ?? sleeperId,
      position: player?.position ?? null,
      state: game?.state ?? ('bye' as const),
    };
  });

  const team = projectTeam(lines.map(({ line }) => line));
  const filled = lines.filter(({ line }) => line.sleeperId !== '0');
  const finished = filled.length > 0 && team.playersRemaining === 0;
  const hasProjections = projectionByPlayerId.size > 0;

  return {
    week: teamGame.week,
    points: teamGame.pointsScored,
    // The stored total rather than the starters' sum, so a finished week's
    // projection is exactly its score.
    projected: !hasProjections
      ? null
      : finished
      ? teamGame.pointsScored
      : team.projected,
    finished,
    starters: filled.map(({ line, name, position, state }) => ({
      sleeperId: line.sleeperId,
      name,
      position,
      points: line.points,
      projected: hasProjections ? round(projectStarter(line)) : null,
      state,
    })),
  };
}

/** A team's total for a round, the sum of its weeks. */
export function roundTotal(
  weeks: WeekLineup[],
  weeksInRound: number,
): RoundTotal {
  const points = round(weeks.reduce((sum, week) => sum + week.points, 0));
  // A week missing its projections would quietly halve a two-week round.
  const projectable =
    weeks.length === weeksInRound &&
    weeks.length > 0 &&
    weeks.every(week => week.projected !== null);
  if (!projectable) return { points, projected: null };

  const projected = weeks.reduce((sum, week) => sum + week.projected!, 0);
  return { points, projected: round(projected) };
}

/** How the bracket looks up a team's total for a round. */
export const roundTotalKey = (round: string, teamId: string) =>
  `${round}:${teamId}`;
