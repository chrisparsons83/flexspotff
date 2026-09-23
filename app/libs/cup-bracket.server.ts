import { cupRounds, roundOf64Matches } from './cup-bracket';
import type { Cup } from '~/models/cup.server';
import type { CupGame } from '~/models/cupgame.server';
import {
  createCupGame,
  getCupGamesByCup,
  updateCupGame,
} from '~/models/cupgame.server';
import { getCupTeamsByCup } from '~/models/cupteam.server';

/**
 * Builds the empty 64-team bracket for a cup's seeded teams, then walks the
 * top seeds through any byes.
 */
export async function createCupBracket(cupId: Cup['id']) {
  // Get all the teams now, we'll need this to reference later
  const cupTeams = await getCupTeamsByCup(cupId);

  // Create all the matches
  const lastRoundMatchIds = [];
  for (const [index, round] of cupRounds.entries()) {
    const matchIdsToLoop = [...lastRoundMatchIds];
    lastRoundMatchIds.length = 0;

    const numberOfMatchesToCreate = Math.pow(2, index);

    if (numberOfMatchesToCreate === 1) {
      const cupGame = await createCupGame({
        cupId,
        round,
        roundSort: index,
        insideRoundSort: 0,
        winnerToTop: false,
        topTeamId: null,
        bottomTeamId: null,
        winningTeamId: null,
        losingTeamId: null,
        winnerToGameId: null,
        containsBye: false,
      });
      lastRoundMatchIds.push(cupGame.id);
    } else if (numberOfMatchesToCreate !== 32) {
      for (let i = 0; i < numberOfMatchesToCreate; i += 2) {
        const prevIndex = i / 2;
        const upperCupGame: CupGame = await createCupGame({
          cupId,
          round,
          roundSort: index,
          insideRoundSort: i,
          winnerToTop: true,
          topTeamId: null,
          bottomTeamId: null,
          winningTeamId: null,
          losingTeamId: null,
          winnerToGameId: matchIdsToLoop[prevIndex],
          containsBye: false,
        });
        const lowerCupGame: CupGame = await createCupGame({
          cupId,
          round,
          roundSort: index,
          insideRoundSort: i + 1,
          winnerToTop: false,
          topTeamId: null,
          bottomTeamId: null,
          winningTeamId: null,
          losingTeamId: null,
          winnerToGameId: matchIdsToLoop[prevIndex],
          containsBye: false,
        });
        lastRoundMatchIds.push(upperCupGame.id, lowerCupGame.id);
      }
    } else {
      for (let i = 0; i < numberOfMatchesToCreate; i += 2) {
        const prevIndex = i / 2;
        const getMatchOne = roundOf64Matches[i];
        const getMatchTwo = roundOf64Matches[i + 1];
        const upperCupGame: CupGame = await createCupGame({
          cupId,
          round,
          roundSort: index,
          insideRoundSort: i,
          winnerToTop: true,
          topTeamId:
            cupTeams.find(cupTeam => cupTeam.seed === getMatchOne[0])?.id ||
            null,
          bottomTeamId:
            cupTeams.find(cupTeam => cupTeam.seed === getMatchOne[1])?.id ||
            null,
          winningTeamId: null,
          losingTeamId: null,
          winnerToGameId: matchIdsToLoop[prevIndex],
          containsBye: cupTeams.find(cupTeam => cupTeam.seed === getMatchOne[1])
            ?.id
            ? false
            : true,
        });
        const lowerCupGame: CupGame = await createCupGame({
          cupId,
          round,
          roundSort: index,
          insideRoundSort: i + 1,
          winnerToTop: false,
          topTeamId:
            cupTeams.find(cupTeam => cupTeam.seed === getMatchTwo[0])?.id ||
            null,
          bottomTeamId:
            cupTeams.find(cupTeam => cupTeam.seed === getMatchTwo[1])?.id ||
            null,
          winningTeamId: null,
          losingTeamId: null,
          winnerToGameId: matchIdsToLoop[prevIndex],
          containsBye: cupTeams.find(cupTeam => cupTeam.seed === getMatchTwo[1])
            ?.id
            ? false
            : true,
        });
        lastRoundMatchIds.push(upperCupGame.id, lowerCupGame.id);
      }
    }
  }

  // Automatically advance bye winners for round one.
  const cupGamesWithBye = (await getCupGamesByCup(cupId)).filter(
    cupGame => cupGame.containsBye,
  );

  const updates: Promise<CupGame>[] = [];
  for (const cupGame of cupGamesWithBye) {
    updates.push(
      updateCupGame(cupGame.id, {
        id: cupGame.id,
        winningTeamId: cupGame.topTeamId,
      }),
    );
    // We won't do this for the final, but this is byes so whatever
    const updateCupGameData: Partial<CupGame> = {
      id: cupGame.winnerToGameId!,
    };
    if (cupGame.winnerToTop) {
      updateCupGameData.topTeamId = cupGame.topTeamId;
    } else {
      updateCupGameData.bottomTeamId = cupGame.topTeamId;
    }
    updates.push(updateCupGame(cupGame.winnerToGameId!, updateCupGameData));
  }
  await Promise.all(updates);
}

/** Stores a game's result and moves the winner into their next game. */
export async function recordCupGameResult(
  cupGame: CupGame,
  winningTeamId: CupGame['winningTeamId'],
  losingTeamId: CupGame['losingTeamId'],
) {
  const promises: Promise<CupGame>[] = [
    updateCupGame(cupGame.id, {
      id: cupGame.id,
      winningTeamId,
      losingTeamId,
    }),
  ];
  if (cupGame.winnerToTop && cupGame.winnerToGameId) {
    promises.push(
      updateCupGame(cupGame.winnerToGameId, {
        id: cupGame.winnerToGameId,
        topTeamId: winningTeamId,
      }),
    );
  } else if (cupGame.winnerToGameId) {
    promises.push(
      updateCupGame(cupGame.winnerToGameId, {
        id: cupGame.winnerToGameId,
        bottomTeamId: winningTeamId,
      }),
    );
  }
  await Promise.all(promises);
}
