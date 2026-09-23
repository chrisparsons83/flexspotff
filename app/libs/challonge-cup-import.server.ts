import type { ChallongeMatchReport, CupTeamCandidate } from './challonge-cup';
import {
  checkBracketPairings,
  matchParticipantsToTeams,
  parseChallongeModule,
} from './challonge-cup';
import { createCupBracket, recordCupGameResult } from './cup-bracket.server';
import { prisma } from '~/db.server';
import type { Cup } from '~/models/cup.server';
import { deleteCupGamesByCup, getCupGamesByCup } from '~/models/cupgame.server';
import {
  createCupTeam,
  deleteCupTeamsByCup,
  getCupTeamsByCup,
} from '~/models/cupteam.server';
import { getCupWeeks } from '~/models/cupweek.server';

export type ChallongeImportResult = {
  report: ChallongeMatchReport;
  imported: boolean;
};

/** Challonge's last round is the final, so round r of R is the round of 2^(R-r+1). */
const cupRoundFor = (round: number, roundCount: number) =>
  `ROUND_OF_${2 ** (roundCount - round + 1)}`;

async function fetchChallongeModule(slug: string) {
  if (!/^[\w-]+$/.test(slug)) {
    throw new Error(`"${slug}" isn't a Challonge bracket slug`);
  }
  const response = await fetch(`https://challonge.com/${slug}/module`);
  if (!response.ok) {
    throw new Error(`Challonge returned ${response.status} for ${slug}`);
  }
  return response.text();
}

/**
 * Rebuilds a cup from a finished Challonge bracket: Challonge's seeds, pairings
 * and winners, attached to this year's teams.
 *
 * The cup's weeks must already be mapped, since that's how Challonge scores are
 * checked against ours. With `dryRun` nothing is written. Otherwise the cup's
 * teams and games are replaced wholesale, so running it again is safe. Nothing
 * is written when the report has errors.
 */
export async function importChallongeCup(
  cup: Cup,
  slug: string,
  { dryRun }: { dryRun: boolean },
): Promise<ChallongeImportResult> {
  const bracket = parseChallongeModule(await fetchChallongeModule(slug));

  const cupWeeks = await getCupWeeks(cup.id);
  const weeksFor = (mapping: string) =>
    cupWeeks
      .filter(cupWeek => cupWeek.mapping === mapping)
      .map(cupWeek => cupWeek.week);

  const seedingWeeks = weeksFor('SEEDING');
  if (seedingWeeks.length === 0) {
    throw new Error('Map the seeding weeks before importing');
  }
  const roundWeeks = new Map<number, number[]>();
  for (let round = 1; round <= bracket.roundCount; round++) {
    const mapping = cupRoundFor(round, bracket.roundCount);
    const weeks = weeksFor(mapping);
    if (weeks.length === 0) {
      throw new Error(`Map the weeks for ${mapping} before importing`);
    }
    roundWeeks.set(round, weeks);
  }

  const teams = await prisma.team.findMany({
    where: { league: { year: cup.year } },
    include: {
      user: true,
      league: true,
      TeamGames: { select: { week: true, pointsScored: true } },
    },
  });
  const candidates: CupTeamCandidate[] = teams.map(team => ({
    teamId: team.id,
    name: team.user?.discordName ?? team.id,
    league: team.league.name,
    weeklyPoints: Object.fromEntries(
      team.TeamGames.map(game => [game.week, game.pointsScored]),
    ),
  }));

  const report = matchParticipantsToTeams({
    bracket,
    teams: candidates,
    seedingWeeks,
    roundWeeks,
  });
  report.errors.push(...checkBracketPairings(bracket));

  // Every check has to pass here: once the old bracket is deleted below,
  // there's no rolling back.
  if (dryRun || report.errors.length > 0) {
    return { report, imported: false };
  }

  await Promise.all([deleteCupTeamsByCup(cup.id), deleteCupGamesByCup(cup.id)]);
  await Promise.all(
    report.assignments.map(({ participant, team }) =>
      createCupTeam({
        cupId: cup.id,
        teamId: team.teamId,
        seed: participant.seed,
      }),
    ),
  );
  await createCupBracket(cup.id);

  const cupTeamIdByTeamId = new Map(
    (await getCupTeamsByCup(cup.id)).map(cupTeam => [
      cupTeam.teamId,
      cupTeam.id,
    ]),
  );
  const cupTeamIdByParticipant = new Map(
    report.assignments.map(({ participant, team }) => [
      participant.id,
      cupTeamIdByTeamId.get(team.teamId)!,
    ]),
  );

  const participantName = new Map(
    bracket.participants.map(participant => [participant.id, participant.name]),
  );

  // A round's games only know their teams once the round before is recorded.
  for (let round = 1; round <= bracket.roundCount; round++) {
    const mapping = cupRoundFor(round, bracket.roundCount);
    const cupGames = (await getCupGamesByCup(cup.id)).filter(
      cupGame => cupGame.round === mapping,
    );

    await Promise.all(
      bracket.matches
        .filter(match => match.round === round)
        .map(match => {
          const player1 = cupTeamIdByParticipant.get(match.player1Id);
          const player2 = cupTeamIdByParticipant.get(match.player2Id);
          const cupGame = cupGames.find(
            game =>
              (game.topTeamId === player1 && game.bottomTeamId === player2) ||
              (game.topTeamId === player2 && game.bottomTeamId === player1),
          );
          if (!cupGame) {
            throw new Error(
              `Round ${round}: no ${mapping} game between ${participantName.get(
                match.player1Id,
              )} and ${participantName.get(
                match.player2Id,
              )} - the brackets don't line up`,
            );
          }
          const [winner, loser] =
            match.winnerId === match.player1Id
              ? [player1!, player2!]
              : [player2!, player1!];
          return recordCupGameResult(cupGame, winner, loser);
        }),
    );
  }

  const unplayed = (await getCupGamesByCup(cup.id)).filter(
    cupGame => !cupGame.containsBye && !cupGame.winningTeamId,
  );
  if (unplayed.length > 0) {
    throw new Error(
      `${unplayed.length} games were left without a winner after the import`,
    );
  }

  return { report, imported: true };
}
