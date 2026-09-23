import type { SeasonWeek } from '@prisma/client';
import { DateTime } from 'luxon';
import {
  getDraftPicksWithOwners,
  getLeagueMatchups,
  getNflPlayers,
  getNflScores,
  getNflState as fetchNflState,
} from '~/libs/sleeper/api.server';
import type {
  SleeperGraphqlNflGames,
  SleeperNflStateJson,
} from '~/libs/sleeper/schemas';
import type { DraftPickCreate } from '~/models/draftpick.server';
import {
  createDraftPick,
  deleteDraftPicks,
  getDraftPicks,
} from '~/models/draftpick.server';
import type { League } from '~/models/league.server';
import { getLeaguesByYear, updateLeague } from '~/models/league.server';
import type { GameCreate } from '~/models/nflgame.server';
import { upsertNflGame } from '~/models/nflgame.server';
import { getNflTeams } from '~/models/nflteam.server';
import type { PlayerCreate } from '~/models/players.server';
import { getPlayers, upsertPlayer } from '~/models/players.server';
import { getSeason } from '~/models/season.server';
import {
  createSeasonWeek,
  getSeasonWeeksBySeason,
} from '~/models/seasonWeek.server';
import { getTeams } from '~/models/team.server';
import type { TeamGame } from '~/models/teamgame.server';
import {
  createTeamGame,
  getTeamGamesByYearAndWeek,
  updateTeamGame,
} from '~/models/teamgame.server';
import { isRegularSeasonWeek } from '~/utils/seasonStructure';

export async function syncAdp(league: League) {
  const sleeperJson = await getDraftPicksWithOwners(league.sleeperDraftId);

  const isDrafted = sleeperJson.length === 180;

  // Delete out existing draft picks for a league
  const draftPicksQuery = await getDraftPicks(league.id);
  if (draftPicksQuery?.teams) {
    const draftPicksArray = draftPicksQuery?.teams
      .flatMap(team => team.DraftPicks)
      .map(team => team.id);
    await deleteDraftPicks(draftPicksArray);
  }

  // Make a map of owners to team ids
  const teams = await getTeams(league.id);
  const ownerTeamIdMap: Map<string, string> = new Map();
  for (const team of teams) {
    ownerTeamIdMap.set(team.sleeperOwnerId, team.id);
  }

  // Make a map of sleeperPlayerIds to internal ids
  const players = await getPlayers();
  const playerSleeperInternalMap: Map<string, string> = new Map();
  for (const player of players) {
    playerSleeperInternalMap.set(player.sleeperId, player.id);
  }

  const promises: Promise<DraftPickCreate>[] = [];
  for (const { pick_no, player_id, picked_by } of sleeperJson) {
    if (
      !ownerTeamIdMap.get(picked_by || '') ||
      !playerSleeperInternalMap.get(player_id || '')
    ) {
      continue;
    }
    const draftPick: DraftPickCreate = {
      pickNumber: pick_no,
      playerId: playerSleeperInternalMap.get(player_id || '')!,
      teamId: ownerTeamIdMap.get(picked_by || '')!,
    };
    promises.push(createDraftPick(draftPick));
  }
  await Promise.all(promises);

  // Only isDrafted belongs to this sync. Writing the whole league object back
  // would also write whatever it held when it was read, which used to undo the
  // draft date syncLeague had just pulled from Sleeper.
  await updateLeague({ id: league.id, isDrafted });

  return true;
}

export async function syncNflGameWeek(year: number, weeks: number[]) {
  // Get season
  const season = await getSeason(year);
  if (!season) {
    throw new Error('No season found for year.');
  }

  // Get weeks
  const seasonWeeks = await getSeasonWeeksBySeason(season);

  // Doing this for speed, might be able to use Prisma connect to remove this
  const sleeperTeamIdToID: Map<string, string> = new Map();
  const nflTeams = await getNflTeams();
  for (const nflTeam of nflTeams) {
    sleeperTeamIdToID.set(nflTeam.sleeperId, nflTeam.id);
  }

  const promises: Promise<SleeperGraphqlNflGames>[] = weeks.map(week =>
    getNflScores(year, week),
  );
  const games = (await Promise.all(promises)).flatMap(result => result.scores);

  // If we don't have any weeks created, this is where we create the weeks for the season.
  if (seasonWeeks.length === 0) {
    const weekStart = games.reduce<Map<number, Date>>((acc, cur) => {
      const curDate = DateTime.fromISO(cur.metadata.date_time).toJSDate();
      const accDate =
        acc.get(cur.week) || DateTime.now().plus({ years: 10 }).toJSDate();
      acc.set(cur.week, curDate < accDate ? curDate : accDate);
      return acc;
    }, new Map());
    const weekUpdatePromises: Promise<SeasonWeek>[] = [];
    for (const [week, firstGameDate] of weekStart.entries()) {
      const firstGameDateLuxon = DateTime.fromJSDate(firstGameDate).setZone(
        'America/Los_Angeles',
      );
      weekUpdatePromises.push(
        createSeasonWeek({
          seasonId: season.id,
          weekNumber: week,
          weekStart: firstGameDateLuxon
            .plus({
              days: (3 - firstGameDateLuxon.weekday) % 7,
            })
            .startOf('day')
            .toJSDate(),
          weekEnd: firstGameDateLuxon
            .plus({
              days: (9 - firstGameDateLuxon.weekday) % 7,
            })
            .endOf('day')
            .toJSDate(),
        }),
      );
    }
    await Promise.all(weekUpdatePromises);
  }

  const gameUpdatePromises: Promise<GameCreate>[] = [];
  for (const game of games) {
    const homeTeamId = sleeperTeamIdToID.get(game.metadata.home_team);
    const awayTeamId = sleeperTeamIdToID.get(game.metadata.away_team);

    // Doing this separate for typescript to not yell at me
    if (!homeTeamId) continue;
    if (!awayTeamId) continue;

    const gameUpsert: GameCreate = {
      sleeperGameId: game.game_id,
      status: game.status,
      gameStartTime: new Date(game.metadata.date_time),
      homeTeamId,
      homeTeamScore: game.metadata.home_score || 0,
      awayTeamId,
      awayTeamScore: game.metadata.away_score || 0,
      week: game.week,
      year,
    };
    gameUpdatePromises.push(upsertNflGame(gameUpsert));
  }
  await Promise.all(gameUpdatePromises);

  return true;
}

export async function syncSleeperWeeklyScores(year: number, week: number) {
  const leagues = await getLeaguesByYear(year);
  const teams = leagues.flatMap(league => league.teams);

  const existingTeamGames = await getTeamGamesByYearAndWeek(year, week);

  const leagueMatchups = await Promise.all(
    leagues.map(async league => ({
      league,
      matchups: await getLeagueMatchups(league.sleeperLeagueId, week),
    })),
  );

  const teamGameUpserts: Promise<TeamGame>[] = [];
  for (const { league, matchups } of leagueMatchups) {
    for (const matchup of matchups) {
      const team = teams.find(
        team =>
          team.leagueId === league.id && team.rosterId === matchup.roster_id,
      );
      if (!team) continue;

      const existingTeamGame = existingTeamGames.find(
        teamGame => teamGame.teamId === team.id && teamGame.week === week,
      );

      const isRegularSeason = isRegularSeasonWeek({
        week,
        year,
        playoffWeekStart: league.playoffWeekStart,
      });

      // Sleeper leaves these null for a roster it hasn't scored yet, and the
      // columns are non-nullable arrays. A missing starter slot is '0', which
      // createTeamGame/updateTeamGame already filter out before connecting.
      const starters = (matchup.starters ?? []).map(starter => starter ?? '0');
      const startingPlayerPoints = (matchup.starters_points ?? []).map(
        points => points ?? 0,
      );

      if (existingTeamGame) {
        teamGameUpserts.push(
          updateTeamGame({
            id: existingTeamGame.id,
            sleeperMatchupId: matchup.matchup_id || -1,
            week,
            starters,
            pointsScored: matchup.points ?? 0,
            teamId: team.id,
            startingPlayerPoints,
            isRegularSeason,
          }),
        );
      } else {
        teamGameUpserts.push(
          createTeamGame({
            sleeperMatchupId: matchup.matchup_id || -1,
            week,
            starters,
            pointsScored: matchup.points ?? 0,
            teamId: team.id,
            startingPlayerPoints,
            isRegularSeason,
          }),
        );
      }
    }
  }
  await Promise.all(teamGameUpserts);
}

export async function syncNflPlayers() {
  const sleeperJson = await getNflPlayers();

  const nflTeamSleeperIdToLocalIdMap: Map<string, string> = new Map();
  const nflTeams = await getNflTeams();
  for (const nflTeam of nflTeams) {
    nflTeamSleeperIdToLocalIdMap.set(nflTeam.sleeperId, nflTeam.id);
  }

  const promises: Promise<PlayerCreate>[] = [];
  for (const [
    sleeperId,
    { position, first_name, last_name, full_name, team },
  ] of Object.entries(sleeperJson)) {
    const player: PlayerCreate = {
      sleeperId,
      position: position,
      firstName: first_name,
      lastName: last_name,
      fullName: full_name || `${first_name} ${last_name}`,
      nflTeam: team,
      currentNFLTeamId: team
        ? nflTeamSleeperIdToLocalIdMap.get(team) || null
        : null,
    };
    promises.push(upsertPlayer(player));

    if (promises.length >= 50) {
      await Promise.all(promises);
      promises.length = 0;
    }
  }

  // We have to add the Oakland Raiders defense manually because they still exist in old versions
  // of teams.
  promises.push(
    upsertPlayer({
      sleeperId: 'OAK',
      position: 'DEF',
      firstName: 'Oakland',
      lastName: 'Raiders',
      fullName: 'Oakland Raiders',
      nflTeam: 'OAK',
      currentNFLTeamId: nflTeamSleeperIdToLocalIdMap.get('LV') || null,
    }),
  );

  await Promise.all(promises);
}

export async function getNflState(): Promise<SleeperNflStateJson> {
  return fetchNflState();
}
