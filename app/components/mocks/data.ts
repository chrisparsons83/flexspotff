/**
 * Sample data for the /design mocks. Every name is made up; the shapes follow
 * what the real pages show.
 */

export type LeagueKey =
  | 'champions'
  | 'admiral'
  | 'dragon'
  | 'galaxy'
  | 'monarch';

/** Full class strings, so Tailwind can find them. */
export const LEAGUES: { key: LeagueKey; name: string; fill: string }[] = [
  {
    key: 'champions',
    name: 'Champions',
    fill: 'bg-league-champions border-league-champions-edge',
  },
  {
    key: 'admiral',
    name: 'Admiral',
    fill: 'bg-league-admiral border-league-admiral-edge',
  },
  {
    key: 'dragon',
    name: 'Dragon',
    fill: 'bg-league-dragon border-league-dragon-edge',
  },
  {
    key: 'galaxy',
    name: 'Galaxy',
    fill: 'bg-league-galaxy border-league-galaxy-edge',
  },
  {
    key: 'monarch',
    name: 'Monarch',
    fill: 'bg-league-monarch border-league-monarch-edge',
  },
];

export const leagueByKey = (key: LeagueKey) =>
  LEAGUES.find(league => league.key === key)!;

export type Medal = 'gold' | 'silver' | 'bronze' | 'sacko';

export const MEDAL_FILLS: Record<Medal, string> = {
  gold: 'bg-medal-gold border-medal-gold-edge text-medal-gold-foreground',
  silver:
    'bg-medal-silver border-medal-silver-edge text-medal-silver-foreground',
  bronze:
    'bg-medal-bronze border-medal-bronze-edge text-medal-bronze-foreground',
  sacko: 'bg-medal-sacko border-medal-sacko-edge text-medal-sacko-foreground',
};

export const CURRENT_WEEK = 6;

export type Result = 'W' | 'L';

export type StandingsRow = {
  manager: string;
  wins: number;
  losses: number;
  medianWins: number;
  medianLosses: number;
  pointsFor: number;
  pointsAgainst: number;
  lastSix: Result[];
};

export const CHAMPIONS_STANDINGS: StandingsRow[] = [
  {
    manager: 'Harbor Lights',
    wins: 5,
    losses: 1,
    medianWins: 5,
    medianLosses: 1,
    pointsFor: 812.4,
    pointsAgainst: 701.2,
    lastSix: ['W', 'W', 'L', 'W', 'W', 'W'],
  },
  {
    manager: 'Quiet Corner',
    wins: 5,
    losses: 1,
    medianWins: 4,
    medianLosses: 2,
    pointsFor: 788.9,
    pointsAgainst: 690.5,
    lastSix: ['W', 'W', 'W', 'W', 'L', 'W'],
  },
  {
    manager: 'Orbit Seven',
    wins: 4,
    losses: 2,
    medianWins: 4,
    medianLosses: 2,
    pointsFor: 801.3,
    pointsAgainst: 744.0,
    lastSix: ['L', 'W', 'W', 'W', 'L', 'W'],
  },
  {
    manager: 'Paper Lantern',
    wins: 4,
    losses: 2,
    medianWins: 3,
    medianLosses: 3,
    pointsFor: 760.1,
    pointsAgainst: 731.8,
    lastSix: ['W', 'L', 'W', 'L', 'W', 'W'],
  },
  {
    manager: 'Grey Meridian',
    wins: 3,
    losses: 3,
    medianWins: 4,
    medianLosses: 2,
    pointsFor: 774.6,
    pointsAgainst: 769.3,
    lastSix: ['L', 'L', 'W', 'W', 'W', 'L'],
  },
  {
    manager: 'Static Bloom',
    wins: 3,
    losses: 3,
    medianWins: 3,
    medianLosses: 3,
    pointsFor: 742.0,
    pointsAgainst: 748.9,
    lastSix: ['W', 'L', 'L', 'W', 'L', 'W'],
  },
  {
    manager: 'Low Tide',
    wins: 3,
    losses: 3,
    medianWins: 2,
    medianLosses: 4,
    pointsFor: 719.7,
    pointsAgainst: 702.6,
    lastSix: ['L', 'W', 'W', 'L', 'W', 'L'],
  },
  {
    manager: 'Field Notes',
    wins: 2,
    losses: 4,
    medianWins: 3,
    medianLosses: 3,
    pointsFor: 735.2,
    pointsAgainst: 780.4,
    lastSix: ['L', 'W', 'L', 'L', 'W', 'L'],
  },
  {
    manager: 'North Arc',
    wins: 2,
    losses: 4,
    medianWins: 2,
    medianLosses: 4,
    pointsFor: 701.8,
    pointsAgainst: 755.1,
    lastSix: ['W', 'L', 'L', 'L', 'L', 'W'],
  },
  {
    manager: 'Slow Burn',
    wins: 2,
    losses: 4,
    medianWins: 1,
    medianLosses: 5,
    pointsFor: 688.4,
    pointsAgainst: 741.7,
    lastSix: ['L', 'L', 'W', 'L', 'W', 'L'],
  },
  {
    manager: 'Copper Line',
    wins: 1,
    losses: 5,
    medianWins: 2,
    medianLosses: 4,
    pointsFor: 710.5,
    pointsAgainst: 790.2,
    lastSix: ['L', 'L', 'L', 'W', 'L', 'L'],
  },
  {
    manager: 'Wide Margin',
    wins: 1,
    losses: 5,
    medianWins: 1,
    medianLosses: 5,
    pointsFor: 667.0,
    pointsAgainst: 750.9,
    lastSix: ['L', 'W', 'L', 'L', 'L', 'L'],
  },
];

/** How many make the playoffs; the line is drawn under this row. */
export const PLAYOFF_SPOTS = 6;

export const LEAGUE_LEADERS: Record<
  LeagueKey,
  { manager: string; record: string }[]
> = {
  champions: [
    { manager: 'Harbor Lights', record: '5-1' },
    { manager: 'Quiet Corner', record: '5-1' },
    { manager: 'Orbit Seven', record: '4-2' },
  ],
  admiral: [
    { manager: 'Long Count', record: '6-0' },
    { manager: 'Second Wind', record: '4-2' },
    { manager: 'Blue Hour', record: '4-2' },
  ],
  dragon: [
    { manager: 'Fair Weather', record: '5-1' },
    { manager: 'Night Shift', record: '5-1' },
    { manager: 'Back Nine', record: '4-2' },
  ],
  galaxy: [
    { manager: 'Open Field', record: '5-1' },
    { manager: 'Glass House', record: '4-2' },
    { manager: 'Red Shift', record: '4-2' },
  ],
  monarch: [
    { manager: 'Last Light', record: '6-0' },
    { manager: 'Cold Open', record: '5-1' },
    { manager: 'Fine Print', record: '3-3' },
  ],
};

/** The signed-in member's games this week, and where each one stands. */
export const YOUR_WEEK: {
  game: string;
  when: string;
  status: string;
  done: boolean;
}[] = [
  {
    game: 'Survivor',
    when: 'Locks Sunday 1:00 pm ET',
    status: 'Not picked',
    done: false,
  },
  {
    game: 'Spread pool',
    when: 'Locks Sunday 1:00 pm ET',
    status: '3 of 14 picked',
    done: false,
  },
  {
    game: 'Locks challenge',
    when: 'Each game\u2019s kickoff',
    status: '5 of 5 locked',
    done: true,
  },
  {
    game: 'Leagues',
    when: 'Waivers Wednesday 11:00 pm ET',
    status: '2 claims in',
    done: true,
  },
];

export const PODCAST = {
  title: 'Week 6 preview: the bye week squeeze',
  date: 'October 9, 2026',
  length: '58 min',
};

export const PROFILE = {
  name: 'Harbor Lights',
  handle: 'harborlights',
  memberSince: 2018,
  honours: [
    { medal: 'gold' as Medal, label: 'Champion', year: 2021 },
    { medal: 'gold' as Medal, label: 'Champion', year: 2024 },
    { medal: 'silver' as Medal, label: 'Runner-up', year: 2023 },
    { medal: 'sacko' as Medal, label: 'Sacko', year: 2019 },
  ],
  seasons: [
    {
      year: 2026,
      league: 'champions' as LeagueKey,
      finish: null,
      record: '5-1',
      pointsFor: 812.4,
    },
    {
      year: 2025,
      league: 'champions' as LeagueKey,
      finish: 4,
      record: '8-6',
      pointsFor: 1820.3,
    },
    {
      year: 2024,
      league: 'champions' as LeagueKey,
      finish: 1,
      record: '11-3',
      pointsFor: 1977.8,
    },
    {
      year: 2023,
      league: 'champions' as LeagueKey,
      finish: 2,
      record: '10-4',
      pointsFor: 1902.1,
    },
    {
      year: 2022,
      league: 'admiral' as LeagueKey,
      finish: 1,
      record: '10-4',
      pointsFor: 1866.0,
    },
    {
      year: 2021,
      league: 'champions' as LeagueKey,
      finish: 1,
      record: '12-2',
      pointsFor: 2011.6,
    },
    {
      year: 2020,
      league: 'galaxy' as LeagueKey,
      finish: 3,
      record: '9-5',
      pointsFor: 1751.2,
    },
    {
      year: 2019,
      league: 'dragon' as LeagueKey,
      finish: 12,
      record: '3-11',
      pointsFor: 1488.9,
    },
    {
      year: 2018,
      league: 'monarch' as LeagueKey,
      finish: 6,
      record: '7-7',
      pointsFor: 1640.4,
    },
  ],
  teamsInLeague: 12,
};

/** The medal for a finish, if it earned one. */
export const medalFor = (finish: number | null, teams: number): Medal | null =>
  finish === 1
    ? 'gold'
    : finish === 2
    ? 'silver'
    : finish === 3
    ? 'bronze'
    : finish === teams
    ? 'sacko'
    : null;
