import type { GameState, StarterLine } from '~/libs/guillotine/projection';
import {
  projectStarter,
  projectTeam,
  readStarter,
  roundPoints,
} from '~/libs/guillotine/projection';
import { bestBallLineup, EMPTY_SLOT } from '~/libs/sleeper/best-ball';

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
  /**
   * Set while the week has no played lineup yet: `sleeper` is the lineup
   * Sleeper has for the team, `optimal` its best projected, as Sleeper's has a
   * gap or a player on bye.
   */
  placeholder: 'sleeper' | 'optimal' | null;
  starters: LineupStarter[];
};

export type RoundTotal = {
  points: number;
  /** Null unless every week of the round has projections. */
  projected: number | null;
};

/** Every cup team's total for the rounds it is in, by round and then team. */
export type RoundTotals = Record<string, Record<string, RoundTotal>>;

/** A team's lineup for one week, as TeamGame stores it. */
type StoredLineup = {
  week: number;
  pointsScored: number;
  starters: string[];
  startingPlayerPoints: number[];
};

/** One team's lineup for one week, from its stored TeamGame. */
export function buildWeekLineup(
  teamGame: StoredLineup,
  { playerBySleeperId, projectionByPlayerId, gameByNflTeam }: WeekFacts,
  now: Date,
): WeekLineup {
  const lines = teamGame.starters.map((sleeperId, index) => {
    const player = playerBySleeperId.get(sleeperId);
    const { name, position, progress, state } = readStarter(
      sleeperId,
      player,
      gameByNflTeam,
      now,
    );
    const line: StarterLine = {
      sleeperId,
      points: teamGame.startingPlayerPoints[index] ?? 0,
      projection: player ? projectionByPlayerId.get(player.id) ?? 0 : 0,
      progress,
    };
    return { line, name, position, state };
  });

  const team = projectTeam(lines.map(({ line }) => line));
  const filled = lines.filter(({ line }) => line.sleeperId !== EMPTY_SLOT);
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
    placeholder: null,
    starters: filled.map(({ line, name, position, state }) => ({
      sleeperId: line.sleeperId,
      name,
      position,
      points: line.points,
      projected: hasProjections ? roundPoints(projectStarter(line)) : null,
      state,
    })),
  };
}

/** A team's lineup for a week yet to start, as TeamPlannedLineup stores it. */
type PlannedLineup = { week: number; starters: string[]; isOptimal: boolean };

const hasNotStarted = ({ gameByNflTeam }: WeekFacts) =>
  gameByNflTeam.size > 0 &&
  [...gameByNflTeam.values()].every(game => game.state === 'pre_game');

/**
 * Whether a stored week is a lineup that played. A full resync stores every
 * week to the end of the season, with whatever lineup Sleeper had that day and
 * no points, so a row alone does not mean much until the week begins.
 */
const hasPlayed = (stored: StoredLineup, facts: WeekFacts) =>
  stored.pointsScored > 0 ||
  (!hasNotStarted(facts) &&
    stored.starters.some(sleeperId => sleeperId !== EMPTY_SLOT));

/**
 * One team's lineups for every week of a round: what it played where there is
 * one, otherwise what it plans to, otherwise nothing.
 */
export function buildRoundLineups(
  {
    teamGames,
    planned,
  }: { teamGames: StoredLineup[]; planned: PlannedLineup[] },
  weeks: number[],
  factsByWeek: Map<number, WeekFacts>,
  now: Date,
): WeekLineup[] {
  return weeks.map(week => {
    const facts = factsByWeek.get(week)!;
    const stored = teamGames.find(game => game.week === week);
    if (stored && hasPlayed(stored, facts)) {
      return buildWeekLineup(stored, facts, now);
    }

    const plan = planned.find(lineup => lineup.week === week);
    if (plan) {
      const lineup = {
        week,
        pointsScored: 0,
        starters: plan.starters,
        startingPlayerPoints: [],
      };
      return {
        ...buildWeekLineup(lineup, facts, now),
        placeholder: plan.isOptimal
          ? ('optimal' as const)
          : ('sleeper' as const),
      };
    }

    return {
      week,
      points: 0,
      projected: null,
      finished: false,
      placeholder: null,
      starters: [],
    };
  });
}

/**
 * The lineup to plan on for a week yet to start. Sleeper keeps a lineup for
 * every future week, but managers tend to leave it alone until that week comes
 * round, so one with a gap or a player on bye is not what they will play: use
 * the roster's best projected instead. With no projections to choose on, it is
 * whatever Sleeper has, or null if that is nothing.
 */
export function chooseLineup({
  starters,
  players,
  rosterPositions,
  projectionBySleeperId,
  positionBySleeperId,
  hasGame,
}: {
  starters: string[];
  /** The whole roster. */
  players: string[];
  /** `roster_positions` from the league info endpoint. */
  rosterPositions: string[];
  projectionBySleeperId: Map<string, number>;
  positionBySleeperId: Map<string, string | null>;
  /** Whether a player's NFL team plays this week. */
  hasGame: (sleeperId: string) => boolean;
}): { starters: string[]; isOptimal: boolean } | null {
  const isReady =
    starters.length > 0 &&
    starters.every(id => id !== EMPTY_SLOT && hasGame(id));
  if (isReady) return { starters, isOptimal: false };

  if (!players.some(id => projectionBySleeperId.has(id))) {
    return starters.some(id => id !== EMPTY_SLOT)
      ? { starters, isOptimal: false }
      : null;
  }
  const best = bestBallLineup({
    rosterPositions,
    playersPoints: Object.fromEntries(
      players.map(id => [
        id,
        hasGame(id) ? projectionBySleeperId.get(id) ?? 0 : 0,
      ]),
    ),
    positionBySleeperId,
  });
  return { starters: best.starters, isOptimal: true };
}

/**
 * A team's total for a round from its lineup for every week of it. A week with
 * no projection leaves the round with none, rather than quietly halving it.
 */
export function roundTotal(weeks: WeekLineup[]): RoundTotal {
  const points = roundPoints(weeks.reduce((sum, week) => sum + week.points, 0));
  const projectable =
    weeks.length > 0 && weeks.every(week => week.projected !== null);
  if (!projectable) return { points, projected: null };

  const projected = weeks.reduce((sum, week) => sum + week.projected!, 0);
  return { points, projected: roundPoints(projected) };
}

/** The league teams in a cup game, leaving out an undrawn side. */
export const cupGameTeamIds = ({
  topTeam,
  bottomTeam,
}: {
  topTeam: { teamId: string } | null;
  bottomTeam: { teamId: string } | null;
}) => [topTeam, bottomTeam].flatMap(side => (side ? [side.teamId] : []));
