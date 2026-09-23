/**
 * Reading a finished Cup bracket off Challonge and lining it up with our teams.
 *
 * Cups from before the site ran them were played on Challonge. Its public
 * embed page (`https://challonge.com/<slug>/module`) carries the whole bracket
 * as JSON in `window._initialStoreState['TournamentStore']`, so no API key is
 * needed.
 *
 * Challonge only knows participants by the Discord name they had at the time,
 * and plenty of those have changed since. What has not changed are the scores:
 * Challonge holds each round's total truncated to a whole number, and the seed
 * order came from the seeding weeks. So participants are matched to teams on
 * those numbers first, with name similarity only as a tiebreaker.
 */
import { roundOf64Matches } from './cup-bracket';

export type ChallongeParticipant = {
  id: number;
  seed: number;
  name: string;
};

export type ChallongeMatch = {
  round: number;
  player1Id: number;
  player2Id: number;
  scores: [number, number];
  winnerId: number;
};

export type ChallongeBracket = {
  participants: ChallongeParticipant[];
  matches: ChallongeMatch[];
  roundCount: number;
};

type RawParticipant = { id: number; seed: number; display_name: string };
type RawMatch = {
  round: number;
  player1: RawParticipant | null;
  player2: RawParticipant | null;
  scores: number[] | null;
  winner_id: number | null;
};
type RawTournamentStore = {
  tournament?: { tournament_type?: string };
  matches_by_round?: Record<string, RawMatch[]>;
};

const STORE_MARKER = "window._initialStoreState['TournamentStore']";

/** Pulls the JSON object literal that starts at `start` out of `text`. */
function extractJsonObject(text: string, start: number): string {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  throw new Error('Challonge bracket data is cut short');
}

export function parseChallongeModule(html: string): ChallongeBracket {
  const markerIndex = html.indexOf(STORE_MARKER);
  if (markerIndex === -1) {
    throw new Error('No Challonge bracket data found on the page');
  }
  const objectStart = html.indexOf('{', markerIndex);
  const store = JSON.parse(
    extractJsonObject(html, objectStart),
  ) as RawTournamentStore;

  // Challonge answers an unknown slug with a demo double elimination bracket
  // rather than a 404, so the bracket type is the check that it's really ours.
  if (store.tournament?.tournament_type !== 'single elimination') {
    throw new Error(
      `Expected a single elimination bracket, found ${
        store.tournament?.tournament_type ?? 'nothing'
      } - check the slug`,
    );
  }

  const participants = new Map<number, ChallongeParticipant>();
  const matches: ChallongeMatch[] = [];

  for (const roundMatches of Object.values(store.matches_by_round ?? {})) {
    for (const match of roundMatches) {
      const { player1, player2, scores, winner_id } = match;
      if (!player1 || !player2 || !winner_id || scores?.length !== 2) {
        throw new Error(
          `Round ${match.round} has an unfinished match - only completed brackets can be imported`,
        );
      }
      for (const player of [player1, player2]) {
        participants.set(player.id, {
          id: player.id,
          seed: player.seed,
          name: player.display_name,
        });
      }
      matches.push({
        round: match.round,
        player1Id: player1.id,
        player2Id: player2.id,
        scores: [scores[0], scores[1]],
        winnerId: winner_id,
      });
    }
  }

  if (matches.length === 0) {
    throw new Error('The Challonge bracket has no matches');
  }

  return {
    participants: [...participants.values()].sort((a, b) => a.seed - b.seed),
    matches: matches.sort((a, b) => a.round - b.round),
    roundCount: Math.max(...matches.map(match => match.round)),
  };
}

export type CupTeamCandidate = {
  teamId: string;
  name: string;
  league: string;
  weeklyPoints: Record<number, number>;
};

export type ParticipantAssignment = {
  participant: ChallongeParticipant;
  team: CupTeamCandidate;
  /** Where the team ranks on seeding-week points among every team that year. */
  seedRank: number;
};

export type ScoreDelta = {
  round: number;
  participantName: string;
  teamName: string;
  challongeScore: number;
  sitePoints: number;
};

export type WinnerDisagreement = {
  round: number;
  challongeWinner: string;
  challongeLoser: string;
  challongeScores: [number, number];
  siteScores: [number, number];
};

export type ChallongeMatchReport = {
  assignments: ParticipantAssignment[];
  seedDifferences: ParticipantAssignment[];
  scoreDeltas: ScoreDelta[];
  winnerDisagreements: WinnerDisagreement[];
  errors: string[];
};

/**
 * Past these, a difference isn't a stat correction any more - it's the wrong
 * team, or the weeks are mapped wrong.
 */
const MAX_SCORE_DELTA = 5;
const MAX_SEED_RANK_DELTA = 3;

/** Challonge holds whole numbers; the epsilon absorbs float noise in sums. */
const truncate = (points: number) => Math.floor(points + 1e-6);

const sumWeeks = (team: CupTeamCandidate, weeks: number[]) =>
  weeks.reduce((total, week) => total + (team.weeklyPoints[week] ?? 0), 0);

function bigrams(name: string) {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const pairs: string[] = [];
  for (let i = 0; i < cleaned.length - 1; i++)
    pairs.push(cleaned.slice(i, i + 2));
  return pairs;
}

/** Dice coefficient over letter pairs: 1 for the same name, 0 for nothing shared. */
export function nameSimilarity(a: string, b: string) {
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  if (aPairs.length === 0 || bPairs.length === 0) return 0;
  const remaining = [...bPairs];
  let shared = 0;
  for (const pair of aPairs) {
    const index = remaining.indexOf(pair);
    if (index !== -1) {
      shared++;
      remaining.splice(index, 1);
    }
  }
  return (2 * shared) / (aPairs.length + bPairs.length);
}

/**
 * Pairs every Challonge participant with one of this year's teams and reports
 * everywhere the site's numbers disagree with what Challonge recorded.
 *
 * `roundWeeks` maps a Challonge round number to the weeks it was scored over.
 */
export function matchParticipantsToTeams({
  bracket,
  teams,
  seedingWeeks,
  roundWeeks,
}: {
  bracket: ChallongeBracket;
  teams: CupTeamCandidate[];
  seedingWeeks: number[];
  roundWeeks: Map<number, number[]>;
}): ChallongeMatchReport {
  const errors: string[] = [];

  if (teams.length < bracket.participants.length) {
    errors.push(
      `Challonge has ${bracket.participants.length} participants but there are only ${teams.length} teams`,
    );
  }

  const seedRanks = new Map(
    [...teams]
      .sort((a, b) => sumWeeks(b, seedingWeeks) - sumWeeks(a, seedingWeeks))
      .map((team, index) => [team.teamId, index + 1]),
  );

  const scoresByParticipant = new Map<
    number,
    { round: number; score: number }[]
  >();
  for (const match of bracket.matches) {
    const pairs: [number, number][] = [
      [match.player1Id, match.scores[0]],
      [match.player2Id, match.scores[1]],
    ];
    for (const [participantId, score] of pairs) {
      const list = scoresByParticipant.get(participantId) ?? [];
      list.push({ round: match.round, score });
      scoresByParticipant.set(participantId, list);
    }
  }

  const roundPoints = (team: CupTeamCandidate, round: number) =>
    sumWeeks(team, roundWeeks.get(round) ?? []);

  const costOf = (
    participant: ChallongeParticipant,
    team: CupTeamCandidate,
  ) => {
    const scoreDelta = (scoresByParticipant.get(participant.id) ?? []).reduce(
      (total, { round, score }) =>
        total + Math.abs(truncate(roundPoints(team, round)) - score),
      0,
    );
    const seedDelta = Math.abs(seedRanks.get(team.teamId)! - participant.seed);
    return (
      10 * scoreDelta +
      10 * seedDelta +
      5 * (1 - nameSimilarity(participant.name, team.name))
    );
  };

  // Cheapest pairings first. With seeds and a score for every round played,
  // the right team is almost always far cheaper than any other.
  const candidates = bracket.participants
    .flatMap(participant =>
      teams.map(team => ({
        participant,
        team,
        cost: costOf(participant, team),
      })),
    )
    .sort((a, b) => a.cost - b.cost);

  const teamByParticipant = new Map<number, CupTeamCandidate>();
  const usedTeams = new Set<string>();
  for (const { participant, team } of candidates) {
    if (teamByParticipant.has(participant.id) || usedTeams.has(team.teamId)) {
      continue;
    }
    teamByParticipant.set(participant.id, team);
    usedTeams.add(team.teamId);
  }

  const assignments: ParticipantAssignment[] = bracket.participants.flatMap(
    participant => {
      const team = teamByParticipant.get(participant.id);
      if (!team) {
        errors.push(
          `No team left for ${participant.name} (seed ${participant.seed})`,
        );
        return [];
      }
      return [{ participant, team, seedRank: seedRanks.get(team.teamId)! }];
    },
  );

  const seedDifferences = assignments.filter(
    assignment => assignment.seedRank !== assignment.participant.seed,
  );
  for (const { participant, team, seedRank } of seedDifferences) {
    if (Math.abs(seedRank - participant.seed) > MAX_SEED_RANK_DELTA) {
      errors.push(
        `${participant.name} is seed ${participant.seed} on Challonge but ${team.name} ranks ${seedRank} on seeding points`,
      );
    }
  }

  // One round off by a lot can be a stat correction; nothing lining up at all
  // means the pairing is wrong.
  for (const { participant, team } of assignments) {
    const played = scoresByParticipant.get(participant.id) ?? [];
    const agreeing = played.filter(
      ({ round, score }) =>
        Math.abs(truncate(roundPoints(team, round)) - score) <= MAX_SCORE_DELTA,
    );
    if (played.length > 0 && agreeing.length === 0) {
      errors.push(
        `None of ${participant.name}'s Challonge scores match ${team.name} - check the week mapping`,
      );
    }
  }

  const participantName = new Map(
    bracket.participants.map(participant => [participant.id, participant.name]),
  );
  const scoreDeltas: ScoreDelta[] = [];
  const winnerDisagreements: WinnerDisagreement[] = [];

  for (const match of bracket.matches) {
    const team1 = teamByParticipant.get(match.player1Id);
    const team2 = teamByParticipant.get(match.player2Id);
    if (!team1 || !team2) continue;

    const sitePoints: [number, number] = [
      roundPoints(team1, match.round),
      roundPoints(team2, match.round),
    ];
    const sides: [number, CupTeamCandidate, number, number][] = [
      [match.player1Id, team1, match.scores[0], sitePoints[0]],
      [match.player2Id, team2, match.scores[1], sitePoints[1]],
    ];
    for (const [participantId, team, challongeScore, points] of sides) {
      if (truncate(points) === challongeScore) continue;
      scoreDeltas.push({
        round: match.round,
        participantName: participantName.get(participantId)!,
        teamName: team.name,
        challongeScore,
        sitePoints: points,
      });
    }

    const challongePlayer1Won = match.winnerId === match.player1Id;
    if (sitePoints[0] > sitePoints[1] !== challongePlayer1Won) {
      const [winnerId, loserId] = challongePlayer1Won
        ? [match.player1Id, match.player2Id]
        : [match.player2Id, match.player1Id];
      winnerDisagreements.push({
        round: match.round,
        challongeWinner: participantName.get(winnerId)!,
        challongeLoser: participantName.get(loserId)!,
        challongeScores: challongePlayer1Won
          ? match.scores
          : [match.scores[1], match.scores[0]],
        siteScores: challongePlayer1Won
          ? sitePoints
          : [sitePoints[1], sitePoints[0]],
      });
    }
  }

  return {
    assignments,
    seedDifferences,
    scoreDeltas,
    winnerDisagreements,
    errors,
  };
}

/**
 * Plays Challonge's results through the site's bracket layout without writing
 * anything, and lists every place they don't fit.
 *
 * The site always builds its round of 64 from `roundOf64Matches`, and each
 * later game is fed by a fixed pair of earlier ones. If Challonge's seeds were
 * shuffled or edited, its pairings can't be reproduced, and an import would
 * fail halfway through writing. This catches that before anything is touched.
 */
export function checkBracketPairings(bracket: ChallongeBracket): string[] {
  const errors: string[] = [];
  const bySeed = new Map(
    bracket.participants.map(participant => [participant.seed, participant]),
  );
  const nameOf = (id: number) =>
    bracket.participants.find(participant => participant.id === id)?.name;

  const seeds = bracket.participants.map(participant => participant.seed);
  if (
    bySeed.size !== bracket.participants.length ||
    seeds.some(seed => seed < 1 || seed > bracket.participants.length)
  ) {
    return ['Challonge seeds must run from 1 with no gaps or repeats'];
  }
  if (bracket.participants.length > 64 || bracket.participants.length < 33) {
    return [
      `The site's bracket takes 33 to 64 teams; Challonge has ${bracket.participants.length}`,
    ];
  }

  // A slot holds a participant id, or nothing where a seed doesn't exist.
  let games: [number | undefined, number | undefined][] = roundOf64Matches.map(
    ([top, bottom]) => [bySeed.get(top)?.id, bySeed.get(bottom)?.id],
  );
  const matched = new Set<ChallongeMatch>();

  for (let size = 64; size >= 2 && errors.length === 0; size /= 2) {
    const round = bracket.roundCount - Math.log2(size) + 1;
    const winners = games.map(([top, bottom]) => {
      if (top === undefined || bottom === undefined) return top ?? bottom;
      const match = bracket.matches.find(
        m =>
          m.round === round &&
          ((m.player1Id === top && m.player2Id === bottom) ||
            (m.player1Id === bottom && m.player2Id === top)),
      );
      if (!match) {
        errors.push(
          `The site's bracket has ${nameOf(top)} against ${nameOf(
            bottom,
          )} in round ${round}, but Challonge doesn't`,
        );
        return undefined;
      }
      matched.add(match);
      return match.winnerId;
    });
    games = [];
    for (let i = 0; i < winners.length; i += 2) {
      games.push([winners[i], winners[i + 1]]);
    }
  }

  if (errors.length === 0 && matched.size !== bracket.matches.length) {
    errors.push(
      `Only ${matched.size} of Challonge's ${bracket.matches.length} matches fit the site's bracket`,
    );
  }

  return errors;
}
