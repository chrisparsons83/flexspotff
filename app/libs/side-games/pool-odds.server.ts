import type { NFLGame } from '@prisma/client';
import { z } from 'zod';

/**
 * The subset of a stored NFL game the odds fetch needs: the kickoff window is
 * derived from the slate's first and last starts.
 */
export type OddsGame = Pick<NFLGame, 'gameStartTime'>;

const oddsApiData = z.array(
  z.object({
    id: z.string(),
    sport_key: z.string(),
    sport_title: z.string(),
    commence_time: z.string(),
    home_team: z.string(),
    away_team: z.string(),
    bookmakers: z.array(
      z.object({
        key: z.string(),
        title: z.string(),
        last_update: z.string(),
        markets: z.array(
          z.object({
            key: z.string(),
            outcomes: z.array(
              z.object({
                name: z.string(),
                price: z.number().optional(),
                point: z.number().optional(),
              }),
            ),
          }),
        ),
      }),
    ),
  }),
);

const SPORT_KEY = 'americanfootball_nfl';
const REGIONS = 'us';
const MARKETS = 'spreads';
const ODDS_FORMAT = 'american';
const DATE_FORMAT = 'iso';
const BOOKMAKERS = 'draftkings';

/** The spreads keyed by team name, as the admin page pre-fills them. */
export type SpreadLinesByTeam = Map<string, number>;

export type SpreadLinesFailureReason =
  | { kind: 'missing-api-key' }
  | { kind: 'api-error'; message: string };

/**
 * What the automation gets back: either the lines, or a reason it can turn into
 * one alert naming what an admin should fix.
 */
export type SpreadLinesResult =
  | { ok: true; linesByTeam: SpreadLinesByTeam }
  | { ok: false; reason: SpreadLinesFailureReason };

/**
 * Fetches DraftKings spreads for the given slate. This is the admin page's
 * path: a missing key throws the same message the page has always shown, and
 * an API failure throws rather than being swallowed.
 */
export async function fetchSpreadLines(
  nflGames: OddsGame[],
): Promise<SpreadLinesByTeam> {
  const apiKey = process.env.SPREADS_API_KEY;
  if (!apiKey) {
    throw new Error('SPREADS_API_KEY is missing.');
  }

  // Find the earliest starting game in nflGames and latest starting game
  const earliestGame = nflGames.reduce((prev, current) =>
    prev.gameStartTime < current.gameStartTime ? prev : current,
  );
  const latestGame = nflGames.reduce((prev, current) =>
    prev.gameStartTime > current.gameStartTime ? prev : current,
  );

  // Add an hour to the latest game start time cause the API is weird
  const gameStartTime = new Date(latestGame.gameStartTime);
  gameStartTime.setHours(gameStartTime.getHours() + 1);

  // Get the start and end dates for the API call
  const commenceTimeFrom =
    earliestGame.gameStartTime.toISOString().slice(0, -5) + 'Z';
  const commenceTimeTo = gameStartTime.toISOString().slice(0, -5) + 'Z';

  const response = await fetch(
    `https://api.the-odds-api.com/v4/sports/${SPORT_KEY}/odds?` +
      new URLSearchParams({
        apiKey,
        regions: REGIONS,
        markets: MARKETS,
        oddsFormat: ODDS_FORMAT,
        dateFormat: DATE_FORMAT,
        bookmakers: BOOKMAKERS,
        commenceTimeFrom,
        commenceTimeTo,
      }).toString(),
  );
  const odds = oddsApiData.parse(await response.json());

  // Create a map of team names to their spread points
  const spreadMapping: SpreadLinesByTeam = new Map();
  odds.forEach(game => {
    const draftkings = game.bookmakers.find(b => b.key === 'draftkings');
    if (draftkings) {
      draftkings.markets[0].outcomes.forEach(outcome => {
        spreadMapping.set(outcome.name, outcome.point || 0);
      });
    }
  });

  return spreadMapping;
}

/**
 * The automation's path: never throws. A missing key and an API failure are
 * kept apart because the first is a configuration fix and the second is worth
 * waiting out.
 */
export async function fetchSpreadLinesResult(
  nflGames: OddsGame[],
): Promise<SpreadLinesResult> {
  if (!process.env.SPREADS_API_KEY) {
    return { ok: false, reason: { kind: 'missing-api-key' } };
  }

  try {
    return { ok: true, linesByTeam: await fetchSpreadLines(nflGames) };
  } catch (error) {
    return {
      ok: false,
      reason: {
        kind: 'api-error',
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
