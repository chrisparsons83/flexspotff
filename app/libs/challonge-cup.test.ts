import type { ChallongeBracket, CupTeamCandidate } from './challonge-cup';
import {
  checkBracketPairings,
  matchParticipantsToTeams,
  nameSimilarity,
  parseChallongeModule,
} from './challonge-cup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const fixtureHtml = readFileSync(
  join(__dirname, '__fixtures__', 'challonge-2021FSCup-module.html'),
  'utf8',
);

const moduleHtml = (store: unknown) =>
  `<script>window._initialStoreState['TournamentStore'] = ${JSON.stringify(
    store,
  )};</script>`;

describe('parseChallongeModule', () => {
  it('reads the 2021 Cup bracket', () => {
    const bracket = parseChallongeModule(fixtureHtml);

    expect(bracket.participants).toHaveLength(60);
    expect(bracket.matches).toHaveLength(59);
    expect(bracket.roundCount).toBe(6);
    expect(bracket.participants[0]).toMatchObject({ seed: 1, name: 'Brando' });

    const final = bracket.matches.find(match => match.round === 6)!;
    const winner = bracket.participants.find(p => p.id === final.winnerId);
    expect(winner?.name).toBe('Tager');
  });

  it('is not thrown by braces inside names', () => {
    const player = (id: number, seed: number, display_name: string) => ({
      id,
      seed,
      display_name,
    });
    const bracket = parseChallongeModule(
      moduleHtml({
        tournament: { tournament_type: 'single elimination' },
        matches_by_round: {
          1: [
            {
              round: 1,
              player1: player(1, 1, 'curly } "quoted"'),
              player2: player(2, 2, '{brace'),
              scores: [100, 90],
              winner_id: 1,
            },
          ],
        },
      }),
    );

    expect(bracket.participants.map(p => p.name)).toEqual([
      'curly } "quoted"',
      '{brace',
    ]);
  });

  it('rejects the demo bracket Challonge serves for an unknown slug', () => {
    expect(() =>
      parseChallongeModule(
        moduleHtml({
          tournament: { tournament_type: 'double elimination' },
          matches_by_round: {},
        }),
      ),
    ).toThrow(/single elimination/);
  });

  it('rejects a bracket that is still being played', () => {
    expect(() =>
      parseChallongeModule(
        moduleHtml({
          tournament: { tournament_type: 'single elimination' },
          matches_by_round: {
            1: [
              {
                round: 1,
                player1: { id: 1, seed: 1, display_name: 'a' },
                player2: null,
                scores: [],
                winner_id: null,
              },
            ],
          },
        }),
      ),
    ).toThrow(/unfinished/);
  });

  it('says so when the page has no bracket at all', () => {
    expect(() => parseChallongeModule('<html></html>')).toThrow(
      /No Challonge bracket/,
    );
  });
});

describe('nameSimilarity', () => {
  it('ignores case and punctuation', () => {
    expect(nameSimilarity('greg irl', 'greg_irl')).toBe(1);
  });

  it('is low for unrelated names', () => {
    expect(nameSimilarity('Jad', 'slimarabia')).toBeLessThan(0.2);
  });
});

describe('matchParticipantsToTeams', () => {
  const bracket = parseChallongeModule(fixtureHtml);
  const seedingWeeks = [1, 2, 3, 4, 5];
  const roundWeeks = new Map([
    [1, [6]],
    [2, [7]],
    [3, [8]],
    [4, [9, 10]],
    [5, [11, 12]],
    [6, [13, 14]],
  ]);

  /**
   * One team per participant whose weeks reproduce the Challonge bracket,
   * named nothing like the participant so only the numbers can match them.
   */
  function teamsFromBracket(source: ChallongeBracket): CupTeamCandidate[] {
    return source.participants.map(participant => {
      const weeklyPoints: Record<number, number> = {};
      for (const week of seedingWeeks) {
        weeklyPoints[week] = 200 - participant.seed + 0.1;
      }
      for (const [round, weeks] of roundWeeks) {
        const match = source.matches.find(
          m =>
            m.round === round &&
            (m.player1Id === participant.id || m.player2Id === participant.id),
        );
        const score = match
          ? match.scores[match.player1Id === participant.id ? 0 : 1]
          : 50;
        for (const week of weeks)
          weeklyPoints[week] = score / weeks.length + 0.2;
      }
      return {
        teamId: `team-${participant.id}`,
        name: `Owner ${participant.seed * 7}`,
        league: 'Test',
        weeklyPoints,
      };
    });
  }

  const teamFor = (teams: CupTeamCandidate[], name: string) => {
    const participant = bracket.participants.find(p => p.name === name)!;
    return teams.find(team => team.teamId === `team-${participant.id}`)!;
  };

  const expectEveryoneMatched = (
    report: ReturnType<typeof matchParticipantsToTeams>,
  ) => {
    expect(report.assignments).toHaveLength(60);
    for (const { participant, team } of report.assignments) {
      expect(team.teamId).toBe(`team-${participant.id}`);
    }
  };

  it('matches every participant on scores alone', () => {
    // Reversed so the input order is no help.
    const teams = teamsFromBracket(bracket).reverse();
    const report = matchParticipantsToTeams({
      bracket,
      teams,
      seedingWeeks,
      roundWeeks,
    });

    expectEveryoneMatched(report);
    expect(report.errors).toEqual([]);
    expect(report.scoreDeltas).toEqual([]);
    expect(report.seedDifferences).toEqual([]);
    expect(report.winnerDisagreements).toEqual([]);
  });

  it('reports an adjacent seed swap without failing', () => {
    const teams = teamsFromBracket(bracket);
    // Seeds are 5 points apart, so seed 13 falls just behind seed 14.
    teamFor(teams, 'Rob').weeklyPoints[1] -= 6;

    const report = matchParticipantsToTeams({
      bracket,
      teams,
      seedingWeeks,
      roundWeeks,
    });

    expectEveryoneMatched(report);
    expect(report.errors).toEqual([]);
    expect(
      report.seedDifferences.map(({ participant, seedRank }) => [
        participant.seed,
        seedRank,
      ]),
    ).toEqual([
      [13, 14],
      [14, 13],
    ]);
  });

  it('reports a result the site would have decided differently', () => {
    const teams = teamsFromBracket(bracket);
    // Eli beat Jay Enn 95-89 on Challonge; a stat correction later flipped it.
    teamFor(teams, 'Eli').weeklyPoints[7] = 88.98;
    teamFor(teams, 'Jay Enn').weeklyPoints[7] = 89.26;

    const report = matchParticipantsToTeams({
      bracket,
      teams,
      seedingWeeks,
      roundWeeks,
    });

    expectEveryoneMatched(report);
    expect(report.errors).toEqual([]);
    expect(report.winnerDisagreements).toEqual([
      {
        round: 2,
        challongeWinner: 'Eli',
        challongeLoser: 'Jay Enn',
        challongeScores: [95, 89],
        siteScores: [88.98, 89.26],
      },
    ]);
    expect(report.scoreDeltas.map(delta => delta.participantName)).toEqual([
      'Eli',
    ]);
  });

  it('fails when the weeks are mapped to the wrong rounds', () => {
    const report = matchParticipantsToTeams({
      bracket,
      teams: teamsFromBracket(bracket),
      seedingWeeks,
      roundWeeks: new Map([...roundWeeks, [1, [7]], [2, [6]]]),
    });

    expect(report.errors.length).toBeGreaterThan(0);
  });

  it('fails when there are fewer teams than participants', () => {
    const report = matchParticipantsToTeams({
      bracket,
      teams: teamsFromBracket(bracket).slice(1),
      seedingWeeks,
      roundWeeks,
    });

    expect(report.errors[0]).toMatch(/60 participants but there are only 59/);
  });
});

describe('checkBracketPairings', () => {
  const bracket = parseChallongeModule(fixtureHtml);

  const withSeeds = (seeds: Record<string, number>): ChallongeBracket => ({
    ...bracket,
    participants: bracket.participants.map(participant => ({
      ...participant,
      seed: seeds[participant.name] ?? participant.seed,
    })),
  });

  it('fits the 2021 Cup onto the site bracket', () => {
    expect(checkBracketPairings(bracket)).toEqual([]);
  });

  it("catches seeds that put Challonge's games in different places", () => {
    // 13 and 14 sit in different quarters, so every pairing they touch moves.
    const errors = checkBracketPairings(withSeeds({ Rob: 14, Templare1: 13 }));

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/Challonge doesn't/);
  });

  it('rejects repeated seeds', () => {
    expect(checkBracketPairings(withSeeds({ Rob: 14 }))).toEqual([
      'Challonge seeds must run from 1 with no gaps or repeats',
    ]);
  });

  it('rejects a bracket too small for the round of 64', () => {
    const small: ChallongeBracket = {
      participants: [
        { id: 1, seed: 1, name: 'a' },
        { id: 2, seed: 2, name: 'b' },
      ],
      matches: [
        { round: 1, player1Id: 1, player2Id: 2, scores: [1, 0], winnerId: 1 },
      ],
      roundCount: 1,
    };

    expect(checkBracketPairings(small)[0]).toMatch(/33 to 64 teams/);
  });
});
