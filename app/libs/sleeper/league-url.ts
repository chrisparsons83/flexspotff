/**
 * Accepts a raw numeric league ID or a full Sleeper URL such as
 * https://sleeper.com/leagues/123456789/... or https://sleeper.app/leagues/123456789
 */
export function parseSleeperLeagueIdFromUrl(input: string): string {
  const match = input.match(/\/leagues\/(\d+)/);
  if (match) return match[1];
  if (/^\d+$/.test(input.trim())) return input.trim();
  throw new Error(
    `Could not parse a Sleeper league ID from: "${input}". Paste the full league URL from sleeper.com.`,
  );
}
