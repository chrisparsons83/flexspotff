import type {
  RecordsCupGame,
  RecordsGame,
  RecordsTeam,
  RecordTable,
} from './records.server';
import { buildRecords } from './records.server';
import { describe, expect, it, vi } from 'vitest';

// The record book maths is pure; stub the client so these run without a
// database. vi.mock is hoisted above the imports above.
vi.mock('~/db.server', () => ({ prisma: {} }));

const YEAR = 2024;
const LAST_WEEK = 14;

const makeTeam = (overrides: Partial<RecordsTeam> = {}): RecordsTeam => ({
  id: 'team-1',
  userId: 'user-1',
  userName: 'Alice',
  leagueId: 'league-1',
  leagueName: 'Admiral',
  year: YEAR,
  wins: 0,
  losses: 0,
  ties: 0,
  medianWins: 0,
  medianLosses: 0,
  medianTies: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  ...overrides,
});

const makeGames = (
  teamId: string,
  scores: number[],
  { startWeek = 1, matchupId = 1 } = {},
): RecordsGame[] =>
  scores.map((pointsScored, index) => ({
    teamId,
    week: startWeek + index,
    sleeperMatchupId: matchupId,
    pointsScored,
  }));

const alwaysFinal = () => true;

const build = ({
  teams,
  games,
  cupGames = [],
  isWeekFinal = alwaysFinal,
}: {
  teams: RecordsTeam[];
  games: RecordsGame[];
  cupGames?: RecordsCupGame[];
  isWeekFinal?: (year: number, week: number) => boolean;
}) => buildRecords({ teams, games, cupGames, isWeekFinal });

const tableByTitle = (tables: RecordTable[], match: string) => {
  const table = tables.find(t => t.title.startsWith(match));
  if (!table) throw new Error(`No table titled "${match}"`);
  return table;
};

/** A finished head-to-head season between two teams in a single league. */
const twoTeamSeason = ({
  weeks = LAST_WEEK,
  homeScore = 120,
  awayScore = 100,
}: { weeks?: number; homeScore?: number; awayScore?: number } = {}) => {
  const teams = [
    makeTeam({ id: 'home', userId: 'user-home', userName: 'Alice' }),
    makeTeam({ id: 'away', userId: 'user-away', userName: 'Bob' }),
  ];
  const scores = Array.from({ length: weeks }, () => homeScore);
  const awayScores = Array.from({ length: weeks }, () => awayScore);

  return {
    teams,
    games: [...makeGames('home', scores), ...makeGames('away', awayScores)],
  };
};

describe('buildRecords', () => {
  describe('season eligibility', () => {
    it('does not count a season that has not been played', () => {
      const { teams, games } = twoTeamSeason();
      // The upcoming season is already in the database with an empty record.
      const upcoming = makeTeam({
        id: 'home-next',
        userId: 'user-home',
        leagueId: 'league-2',
        year: YEAR + 1,
      });

      const { careerRecords } = build({
        teams: [...teams, upcoming],
        games,
      });

      const seasonsPlayed = tableByTitle(careerRecords, 'Most Seasons Played');
      const alice = seasonsPlayed.rows.find(row => row.cells[0] === 'Alice');

      expect(alice?.cells[1]).toBe('1');
    });

    it('averages career points over completed seasons only', () => {
      const fullSeason = Array.from({ length: LAST_WEEK }, () => 100);

      // Two finished seasons plus one that has only played a single week.
      const teams = [
        makeTeam({
          id: 'a-2023',
          leagueId: 'league-2023',
          year: 2023,
          pointsFor: 1600,
        }),
        makeTeam({
          id: 'a-2024',
          leagueId: 'league-2024',
          year: 2024,
          pointsFor: 1400,
        }),
        makeTeam({
          id: 'a-2025',
          leagueId: 'league-2025',
          year: 2025,
          pointsFor: 100,
        }),
      ];
      const games = [
        ...makeGames('a-2023', fullSeason),
        ...makeGames('a-2024', fullSeason),
        ...makeGames('a-2025', [100]),
      ];

      const { careerRecords } = build({ teams, games });

      // All three seasons were played, but only the finished two feed the
      // average - otherwise a single week of the new season drags it down.
      expect(
        tableByTitle(careerRecords, 'Most Seasons Played').rows[0].cells[1],
      ).toBe('3');

      const alice = tableByTitle(
        careerRecords,
        'Highest Average Points For per Season',
      ).rows[0];
      expect(alice.cells[1]).toBe('1500.00');
      expect(alice.cells[2]).toBe('3000.00');
      expect(alice.cells[3]).toBe('2');
    });

    it('keeps an in-progress season out of best win percentage', () => {
      const { teams, games } = twoTeamSeason({ weeks: 4 });
      teams[0].wins = 4;
      teams[1].losses = 4;

      const { singleSeasonRecords } = build({ teams, games });

      expect(
        tableByTitle(singleSeasonRecords, 'Best Win Percentage').rows,
      ).toHaveLength(0);
      // It still shows up in the counting table, where a partial total is
      // simply a small total.
      expect(
        tableByTitle(singleSeasonRecords, 'Most Wins in a Season').rows[0]
          .cells,
      ).toEqual(['Alice', '4-0-0', '2024', 'Admiral']);
    });
  });

  describe('single game', () => {
    it('ignores weeks whose games are still in progress', () => {
      const { teams, games } = twoTeamSeason({ weeks: 3 });
      games.push(
        ...makeGames('home', [999], { startWeek: 4 }),
        ...makeGames('away', [1], { startWeek: 4 }),
      );

      const { singleGameRecords } = build({
        teams,
        games,
        isWeekFinal: (_year, week) => week < 4,
      });

      const highest = tableByTitle(
        singleGameRecords,
        'Highest Score in a Single Week',
      );
      const lowest = tableByTitle(
        singleGameRecords,
        'Lowest Score in a Single Week',
      );

      expect(highest.rows[0].cells[1]).toBe('120.00');
      expect(lowest.rows[0].cells[1]).toBe('100.00');
    });
  });

  describe('streaks', () => {
    it('breaks a streak on an unplayed week instead of skipping it', () => {
      const teams = [
        makeTeam({ id: 'home', userId: 'user-home', userName: 'Alice' }),
        makeTeam({ id: 'away', userId: 'user-away', userName: 'Bob' }),
      ];

      // Alice wins weeks 1-3 and 5-7, with week 4 never played.
      const weeks = [1, 2, 3, 5, 6, 7];
      const games: RecordsGame[] = [];
      for (const week of weeks) {
        games.push(
          { teamId: 'home', week, sleeperMatchupId: 1, pointsScored: 120 },
          { teamId: 'away', week, sleeperMatchupId: 1, pointsScored: 100 },
        );
      }

      const { streakRecords } = build({ teams, games });
      const winStreaks = tableByTitle(streakRecords, 'Longest Win Streak');
      const alice = winStreaks.rows.find(row => row.cells[0] === 'Alice');

      expect(alice?.cells[1]).toBe('3');
      expect(alice?.cells[2]).toBe('2024 W1-W3');
    });

    it('counts the median game as a second result each week', () => {
      const teams = [
        makeTeam({
          id: 'home',
          userId: 'user-home',
          userName: 'Alice',
          medianWins: 3,
        }),
        makeTeam({ id: 'away', userId: 'user-away', userName: 'Bob' }),
      ];
      const games = [
        ...makeGames('home', [120, 120, 120]),
        ...makeGames('away', [100, 100, 100]),
      ];

      const { streakRecords } = build({ teams, games });
      const winStreaks = tableByTitle(streakRecords, 'Longest Win Streak');
      const lossStreaks = tableByTitle(streakRecords, 'Longest Losing Streak');

      // Three weeks, each worth a head-to-head result and a median result.
      expect(
        winStreaks.rows.find(row => row.cells[0] === 'Alice')?.cells[1],
      ).toBe('6');
      expect(
        lossStreaks.rows.find(row => row.cells[0] === 'Bob')?.cells[1],
      ).toBe('6');
    });

    it('counts one result per week for leagues without median scoring', () => {
      const teams = [
        makeTeam({ id: 'home', userId: 'user-home', userName: 'Alice' }),
        makeTeam({ id: 'away', userId: 'user-away', userName: 'Bob' }),
      ];
      const games = [
        ...makeGames('home', [120, 120, 120]),
        ...makeGames('away', [100, 100, 100]),
      ];

      const { streakRecords } = build({ teams, games });

      expect(
        tableByTitle(streakRecords, 'Longest Win Streak').rows.find(
          row => row.cells[0] === 'Alice',
        )?.cells[1],
      ).toBe('3');
    });

    it('does not double count the 100+ point streak', () => {
      const teams = [
        makeTeam({
          id: 'home',
          userId: 'user-home',
          userName: 'Alice',
          medianWins: 3,
        }),
        makeTeam({ id: 'away', userId: 'user-away', userName: 'Bob' }),
      ];
      const games = [
        ...makeGames('home', [120, 120, 120]),
        ...makeGames('away', [99, 99, 99]),
      ];

      const { streakRecords } = build({ teams, games });

      expect(
        tableByTitle(streakRecords, 'Longest 100+ Point Streak').rows[0]
          .cells[1],
      ).toBe('3');
    });
  });

  describe('single season points', () => {
    it('sums regular season games rather than the stored season total', () => {
      const { teams, games } = twoTeamSeason({
        weeks: LAST_WEEK,
        homeScore: 110,
        awayScore: 90,
      });
      // A stored total that includes playoff weeks must not leak through.
      teams[0].pointsFor = 9999;
      teams[0].pointsAgainst = 9999;

      const { singleSeasonRecords } = build({ teams, games });

      expect(
        tableByTitle(singleSeasonRecords, 'Most Points For in a Season').rows[0]
          .cells[1],
      ).toBe((110 * LAST_WEEK).toFixed(2));
      expect(
        tableByTitle(singleSeasonRecords, 'Most Points Against in a Season')
          .rows[0].cells[1],
      ).toBe((110 * LAST_WEEK).toFixed(2));
      expect(
        tableByTitle(singleSeasonRecords, 'Largest Points Differential').rows[0]
          .cells[1],
      ).toBe(`+${(20 * LAST_WEEK).toFixed(2)}`);
    });
  });

  describe('cup', () => {
    const user = (id: string, name: string) => ({ userId: id, userName: name });

    it('excludes byes from wins and games played', () => {
      const cupGames: RecordsCupGame[] = [
        {
          round: 'ROUND_OF_64',
          containsBye: true,
          topUser: user('user-1', 'Alice'),
          bottomUser: null,
          winningUser: user('user-1', 'Alice'),
        },
        {
          round: 'ROUND_OF_32',
          containsBye: false,
          topUser: user('user-1', 'Alice'),
          bottomUser: user('user-2', 'Bob'),
          winningUser: user('user-1', 'Alice'),
        },
      ];

      const { cupRecords } = build({ teams: [], games: [], cupGames });
      const wins = tableByTitle(cupRecords, 'Most Cup Game Wins');
      const alice = wins.rows.find(row => row.cells[0] === 'Alice');

      expect(alice?.cells[1]).toBe('1');
      expect(alice?.cells[2]).toBe('1');
      expect(alice?.cells[3]).toBe('100.0%');
    });

    it('still credits finals and championships', () => {
      const cupGames: RecordsCupGame[] = [
        {
          round: 'ROUND_OF_2',
          containsBye: false,
          topUser: user('user-1', 'Alice'),
          bottomUser: user('user-2', 'Bob'),
          winningUser: user('user-1', 'Alice'),
        },
      ];

      const { cupRecords } = build({ teams: [], games: [], cupGames });

      expect(
        tableByTitle(cupRecords, 'Most Cup Championships').rows[0].cells,
      ).toEqual(['Alice', '1', '1', '1']);
      expect(
        tableByTitle(cupRecords, 'Most Cup Finals Appearances').rows.map(
          row => row.cells[0],
        ),
      ).toEqual(['Alice', 'Bob']);
    });
  });

  describe('ranking', () => {
    it('gives tied rows the same rank and skips the next', () => {
      // Alice reached two finals; Bob and Cara reached one each.
      const finalists = ['Alice', 'Alice', 'Bob', 'Cara'];
      const cupGames: RecordsCupGame[] = finalists.map(name => ({
        round: 'ROUND_OF_2',
        containsBye: false,
        topUser: user(name.toLowerCase(), name),
        bottomUser: null,
        winningUser: null,
      }));

      const { cupRecords } = build({ teams: [], games: [], cupGames });
      const finals = tableByTitle(cupRecords, 'Most Cup Finals Appearances');

      expect(finals.rows.map(row => [row.cells[0], row.rank])).toEqual([
        ['Alice', 1],
        ['Bob', 2],
        ['Cara', 2],
      ]);
    });

    function user(id: string, name: string) {
      return { userId: id, userName: name };
    }
  });
});
