import type { GameState, StarterLine } from './projection';
import {
  chopLine,
  gameProgress,
  projectStarter,
  projectTeam,
} from './projection';
import { getWeekNflGames } from '~/models/nflgame.server';
import { getPlayersBySleepersIds } from '~/models/players.server';

type LiveTeam = {
  rosterId: number;
  choppedWeek: number | null;
  weekScores: {
    week: number;
    points: number;
    starters: string[];
    startingPlayerPoints: number[];
    starterProjections: number[];
  }[];
};

export type LiveStarter = {
  sleeperId: string;
  name: string;
  position: string | null;
  nflTeam: string | null;
  points: number;
  projection: number;
  projected: number;
  state: GameState | 'bye';
};

/**
 * The chop line for a week in progress: every surviving team's points so far,
 * players left and projected total, ranked, with the team on course to be
 * chopped marked.
 *
 * Starters' games come from the NFL schedule the live score monitor keeps
 * current, and each starter's projection was stored by the guillotine sync in
 * the league's own scoring.
 */
export async function buildLiveChopLine({
  year,
  week,
  teams,
  now = new Date(),
}: {
  year: number;
  week: number;
  teams: LiveTeam[];
  now?: Date;
}) {
  const alive = teams
    .filter(team => team.choppedWeek === null || team.choppedWeek >= week)
    .map(team => ({
      rosterId: team.rosterId,
      score: team.weekScores.find(s => s.week === week),
    }))
    .filter(
      (team): team is { rosterId: number; score: LiveTeam['weekScores'][0] } =>
        Boolean(team.score),
    );

  const starterIds = Array.from(
    new Set(
      alive.flatMap(team => team.score.starters.filter(id => id !== '0')),
    ),
  );
  const [players, games] = await Promise.all([
    getPlayersBySleepersIds(starterIds),
    getWeekNflGames(year, week),
  ]);
  const playerById = new Map(players.map(p => [p.sleeperId, p]));

  // An NFL team's game this week, looked up by the abbreviation players carry.
  const gameByTeam = new Map<string, { state: GameState; kickoff: Date }>();
  for (const game of games) {
    const entry = {
      state: game.status as GameState,
      kickoff: game.gameStartTime,
    };
    gameByTeam.set(game.homeTeam.sleeperId, entry);
    gameByTeam.set(game.awayTeam.sleeperId, entry);
  }

  const rows = alive.map(({ rosterId, score }) => {
    const starters: (StarterLine & LiveStarter)[] = score.starters.map(
      (sleeperId, index) => {
        const player = playerById.get(sleeperId);
        // A defense's Sleeper ID is its team abbreviation.
        const nflTeam = player?.nflTeam ?? (player ? null : sleeperId);
        const game = nflTeam ? gameByTeam.get(nflTeam) : undefined;
        const points = score.startingPlayerPoints[index] ?? 0;
        const projection = score.starterProjections[index] ?? 0;
        // No game this week is a bye, which is as finished as a final.
        const progress =
          sleeperId === '0' || !game
            ? 1
            : gameProgress({ state: game.state, kickoff: game.kickoff, now });

        const line = { sleeperId, points, projection, progress };
        return {
          ...line,
          name: sleeperId === '0' ? 'Empty' : player?.fullName ?? sleeperId,
          position: player?.position ?? null,
          nflTeam,
          projected: projectStarter(line),
          state: sleeperId !== '0' && !game ? 'bye' : game?.state ?? 'complete',
        };
      },
    );

    // Sleeper sends no starters for a team that has not set a lineup for the
    // week yet, which is common early in the week. Nothing to project then.
    const lineupSet = starters.some(starter => starter.sleeperId !== '0');
    return { rosterId, ...projectTeam(starters), starters, lineupSet };
  });

  // A team with no lineup yet has nothing to project, and would drag the
  // chop line to zero for everyone else. They are listed after the ranked
  // teams until Sleeper has a lineup for them, usually before kickoff.
  const ranked = chopLine(rows.filter(row => row.lineupSet));
  const unset = rows
    .filter(row => !row.lineupSet)
    .map((row, index) => ({
      ...row,
      rank: ranked.length + index + 1,
      onTheBlock: false,
      margin: null,
    }));
  return [...ranked, ...unset];
}

export type LiveChopLine = Awaited<ReturnType<typeof buildLiveChopLine>>;
