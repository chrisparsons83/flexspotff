export const DAYS_AHEAD = 30;
export const SERVER_DISCORD_ID = `214093545747906562`;
export const SERVER_DISCORD_ADMIN_ROLE_ID = `214097556051984385`;
export const SERVER_DISCORD_PODCAST_ADMIN_ROLE_ID = `1006075042293108746`;
export const SLEEPER_ADMIN_ID = `329096543967641600`;

export enum Leagues {
  admiral = "admiral",
  champions = "champions",
  dragon = "dragon",
  galaxy = "galaxy",
  monarch = "monarch",
}
export const isLeagueName = (value: string): value is Leagues =>
  value in Leagues;

export const RANK_COLORS: Record<Leagues, string> = {
  admiral: "bg-admiral text-gray-900",
  champions: "bg-champions text-gray-900",
  dragon: "bg-dragon text-gray-900",
  galaxy: "bg-galaxy text-gray-900",
  monarch: "bg-monarch text-gray-900",
};
