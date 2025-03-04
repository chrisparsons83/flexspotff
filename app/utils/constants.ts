export const DAYS_AHEAD = 30;
export const SERVER_DISCORD_ID = `214093545747906562`;
export const SERVER_DISCORD_ADMIN_ROLE_ID = `214097556051984385`;
export const SERVER_DISCORD_PODCAST_ADMIN_ROLE_ID = `1006075042293108746`;
export const SLEEPER_ADMIN_ID = `329096543967641600`;

export const FIRST_YEAR = 2018;

export enum Leagues {
  admiral = 'admiral',
  champions = 'champions',
  dragon = 'dragon',
  galaxy = 'galaxy',
  monarch = 'monarch',
}
export const isLeagueName = (value: string): value is Leagues =>
  value in Leagues;

export const RANK_COLORS: Record<Leagues, string> = {
  admiral: 'bg-admiral text-gray-900',
  champions: 'bg-champions text-gray-900',
  dragon: 'bg-dragon text-gray-900',
  galaxy: 'bg-galaxy text-gray-900',
  monarch: 'bg-monarch text-gray-900',
};

type RoundName = {
  key: string;
  label: string;
};
export const roundNameMapping: RoundName[] = [
  { key: 'ROUND_OF_64', label: 'Round of 64' },
  { key: 'ROUND_OF_32', label: 'Round of 32' },
  { key: 'ROUND_OF_16', label: 'Round of 16' },
  { key: 'ROUND_OF_8', label: 'Quarterfinals' },
  { key: 'ROUND_OF_4', label: 'Semifinals' },
  { key: 'ROUND_OF_2', label: 'Finals' },
];

export const SPORTS_LIST = [
  {
    id: 'golfm',
    name: 'Golf - Mens',
  },
  {
    id: 'golfw',
    name: 'Golf - Womens',
  },
  {
    id: 'tennism',
    name: 'Tennis - Mens',
  },
  {
    id: 'tennisw',
    name: 'Tennis - Womens',
  },
  {
    id: 'mlb',
    name: 'MLB',
  },
  {
    id: 'nhl',
    name: 'NHL',
  },
  {
    id: 'nba',
    name: 'NBA',
  },
  {
    id: 'nfl',
    name: 'NFL',
  },
  {
    id: 'ncaam',
    name: 'NCAA Basketball - Mens',
  },
  {
    id: 'ncaaw',
    name: 'NCAA Basketball - Womens',
  },
  {
    id: 'ncaaf',
    name: 'NCAA Football',
  },
  {
    id: 'lol',
    name: 'LoL World Championship',
  },
  {
    id: 'darts',
    name: 'PDC Darts World Championship',
  },
  {
    id: 'ncaalm',
    name: 'NCAA Lacrosse - Mens',
  },
  {
    id: 'nascar',
    name: 'NASCAR',
  },
  {
    id: 'f1',
    name: 'F1',
  },
  {
    id: 'mls',
    name: 'MLS',
  },
  {
    id: 'uefa',
    name: 'UEFA Champions League',
  },
  {
    id: 'afl',
    name: 'Aussie Rules AFL Premiership',
  },
]
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(sport => ({
    name: sport.name,
    value: sport.id,
  }));
