export const DAYS_AHEAD = 30;
export const SERVER_DISCORD_ID = `214093545747906562`;
export const SERVER_DISCORD_ADMIN_ROLE_ID = `214097556051984385`;
export const SERVER_DISCORD_PODCAST_ADMIN_ROLE_ID = `1006075042293108746`;
export const SLEEPER_ADMIN_ID = `329096543967641600`;

export const FIRST_YEAR = 2018;
export const OMNI_YEAR = 2025;

export enum Leagues {
  admiral = 'admiral',
  champions = 'champions',
  dragon = 'dragon',
  galaxy = 'galaxy',
  monarch = 'monarch',
}
export const isLeagueName = (value: string): value is Leagues =>
  value in Leagues;

export const POSITION_RANK_COLORS: Record<string, string> = {
  qb: 'bg-qb',
  rb: 'bg-rb',
  wr: 'bg-wr',
  te: 'bg-te',
  def: 'bg-def',
};

/**
 * Left-border accents for a starter's position, used in the expandable rows on
 * the weekly leaderboards. Distinct from POSITION_RANK_COLORS above, which
 * fills a chip background rather than drawing a border.
 */
export const POSITION_BORDER_COLORS: Record<string, string> = {
  qb: 'border-qb',
  rb: 'border-rb',
  wr: 'border-wr',
  te: 'border-te',
  def: 'border-def',
  empty: 'border-gray-500',
};

export const RANK_COLORS: Record<Leagues, string> = {
  admiral: 'bg-admiral text-gray-900',
  champions: 'bg-champions text-gray-900',
  dragon: 'bg-dragon text-gray-900',
  galaxy: 'bg-galaxy text-gray-900',
  monarch: 'bg-monarch text-gray-900',
};

/**
 * Podium colours for the boards with no league colour to key off - the D12
 * boards, where a manager's rows span several leagues. Fills the same badge as
 * RANK_COLORS above, but by placement rather than by league. Everyone off the
 * podium shares one colour, which is deliberately the galaxy blue - on the D12
 * boards no badge means a league, so there is nothing to confuse it with.
 */
export const PODIUM_RANK_COLORS: Record<number, string> = {
  1: 'bg-gold text-gray-900',
  2: 'bg-silver text-gray-900',
  3: 'bg-bronze text-gray-900',
};
export const DEFAULT_RANK_COLOR = 'bg-galaxy text-gray-900';

/**
 * Keyed off the rank rather than the row index, so competition ranking carries
 * through: two managers tied for 2nd both take silver and nobody takes bronze.
 */
export const rankBadgeColor = (rank: number) =>
  PODIUM_RANK_COLORS[rank] ?? DEFAULT_RANK_COLOR;

/**
 * A leaderboard name that links somewhere. Undoes the prose link treatment the
 * root layout applies - underline, weight, colour - so a linked name sits flush
 * with the unlinked names on the league boards, keeping the underline as a
 * hover affordance only.
 */
export const LEADERBOARD_NAME_LINK =
  'font-normal text-inherit no-underline hover:underline';

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
