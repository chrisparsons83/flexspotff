import type { League } from '@prisma/client';
import { EmbedBuilder, embedLength } from 'discord.js';
import { sendMessageToChannel } from '~/../bot/utils';
import { getLeagueUsers } from '~/libs/sleeper/api.server';
import { getOwnerToUserIdMap } from '~/libs/sleeper/owners.server';
import { syncLeagueWaivers } from '~/libs/waiver-sync.server';
import { getLeaguesByYear } from '~/models/league.server';
import type { WaiverTransactionWithRelations } from '~/models/waiver.server';
import {
  getWaiverReport,
  getWaiverTransactions,
  recordWaiverReport,
} from '~/models/waiver.server';
import { isLeagueName, leagueEmbedColor } from '~/utils/constants';

/**
 * Discord allows 4096 characters in an embed description. Pack well short of it
 * so a busy week splits into a second embed rather than silently truncating.
 */
const MAX_DESCRIPTION_LENGTH = 3800;

/**
 * What one Discord message can carry: at most 10 embeds, and 6000 characters
 * summed across all of them. Both are hard rejections - Discord 400s the whole
 * message rather than trimming it - so anything sending embeds has to split them
 * up rather than hope they fit.
 */
const MAX_EMBEDS_PER_MESSAGE = 10;
const MAX_MESSAGE_EMBED_CHARS = 6000;

/**
 * Splits embeds into groups that each fit in a single message.
 *
 * `embedLength` is Discord's own accounting - title, description, footer, author
 * and fields - so this measures what the API will measure rather than guessing.
 * A single embed that somehow exceeds the whole message budget still gets its own
 * group: it will be rejected either way, and dropping it silently would be worse.
 */
export function chunkEmbedsForMessages(
  embeds: EmbedBuilder[],
): EmbedBuilder[][] {
  const groups: EmbedBuilder[][] = [];
  let current: EmbedBuilder[] = [];
  let currentLength = 0;

  for (const embed of embeds) {
    const length = embedLength(embed.data);
    const wouldOverflow =
      current.length >= MAX_EMBEDS_PER_MESSAGE ||
      currentLength + length > MAX_MESSAGE_EMBED_CHARS;

    if (wouldOverflow && current.length > 0) {
      groups.push(current);
      current = [];
      currentLength = 0;
    }

    current.push(embed);
    currentLength += length;
  }

  if (current.length > 0) groups.push(current);

  return groups;
}

/**
 * Sleeper's note on a claim that lost to a higher bid. Anything else that failed
 * - a full roster, not enough budget - did not lose an auction, and saying it
 * was outbid would be wrong.
 */
const OUTBID_NOTE = 'This player was claimed by another owner.';

/**
 * Short labels for the other ways a claim fails, because Sleeper's own wording is
 * a full sentence and a busy week repeats it a dozen times. These are every
 * failure note seen across a full season of these five leagues; anything new
 * falls through to Sleeper's text so it is still legible.
 */
const FAILURE_LABELS: Record<string, string> = {
  'Unfortunately, your roster will have too many players after this transaction.':
    'roster full',
  'You are over the budget for this transaction.': 'over budget',
  'One of the players you are trying to drop has already started playing.':
    'drop already played',
};

const isOutbid = (transaction: { notes: string | null }) =>
  transaction.notes === OUTBID_NOTE;

const failureLabel = (notes: string | null) => {
  if (!notes) return 'failed';
  return FAILURE_LABELS[notes] ?? notes;
};

/**
 * How a manager is shown in the embed.
 *
 * A `<@id>` mention inside an embed renders as a name chip but does not notify -
 * that is what makes the report readable without pinging twelve people at
 * midnight. `allowed_mentions: { parse: [] }` on the message is the second layer.
 *
 * An owner we have never linked has no Discord ID to mention, so their Sleeper
 * display name goes in as plain text and the report stays complete.
 */
function managerLabel(
  transaction: Pick<WaiverTransactionWithRelations, 'user' | 'sleeperOwnerId'>,
  sleeperNamesByOwnerId: Map<string, string>,
) {
  if (transaction.user) {
    return `<@${transaction.user.discordId}>`;
  }
  return sleeperNamesByOwnerId.get(transaction.sleeperOwnerId) ?? 'Unknown';
}

function playerLabel(transaction: WaiverTransactionWithRelations) {
  if (!transaction.addPlayer) {
    // A pickup Sleeper knows about but our player table does not - the weekly
    // sync runs Tuesdays, so a player added mid-week lands here. Show the raw
    // key rather than dropping the claim.
    return `Unknown player (${transaction.addSleeperId})`;
  }

  const { fullName, position, nflTeam } = transaction.addPlayer;
  const detail = [position, nflTeam].filter(Boolean).join(' ');
  return detail ? `${fullName} (${detail})` : fullName;
}

type PlayerGroup = {
  addSleeperId: string;
  label: string;
  winner?: WaiverTransactionWithRelations;
  losers: WaiverTransactionWithRelations[];
};

/**
 * Groups a week's claims by the player being added, so each contested player
 * reads as one block: who won, then everyone they outbid.
 */
export function groupByPlayer(
  transactions: WaiverTransactionWithRelations[],
): PlayerGroup[] {
  const groups = new Map<string, PlayerGroup>();

  // Highest bid first, and on a tie the lower seq - Sleeper's own resolution
  // order, so the winner sorts to the front of its group naturally.
  const ordered = [...transactions].sort(
    (a, b) => b.bid - a.bid || a.seq - b.seq,
  );

  for (const transaction of ordered) {
    let group = groups.get(transaction.addSleeperId);
    if (!group) {
      group = {
        addSleeperId: transaction.addSleeperId,
        label: playerLabel(transaction),
        losers: [],
      };
      groups.set(transaction.addSleeperId, group);
    }

    if (transaction.status === 'complete' && !group.winner) {
      group.winner = transaction;
    } else {
      group.losers.push(transaction);
    }
  }

  // Most contested players first, then by winning bid - the interesting rows
  // belong at the top.
  return [...groups.values()].sort(
    (a, b) =>
      b.losers.length - a.losers.length ||
      (b.winner?.bid ?? 0) - (a.winner?.bid ?? 0),
  );
}

function renderGroupLines(
  group: PlayerGroup,
  sleeperNamesByOwnerId: Map<string, string>,
) {
  const lines = [`**${group.label}**`];

  if (group.winner) {
    const drop = group.winner.dropPlayer
      ? ` · dropped ${group.winner.dropPlayer.fullName}`
      : '';
    lines.push(
      `✅ $${group.winner.bid} — ${managerLabel(
        group.winner,
        sleeperNamesByOwnerId,
      )}${drop}`,
    );
  }

  for (const loser of group.losers) {
    const label = managerLabel(loser, sleeperNamesByOwnerId);
    if (isOutbid(loser)) {
      lines.push(`❌ $${loser.bid} — ${label}`);
    } else {
      // Not an auction loss; say why so it is not read as being outbid.
      lines.push(`⚠️ $${loser.bid} — ${label} (${failureLabel(loser.notes)})`);
    }
  }

  return lines;
}

export type BuildWaiverEmbedsArgs = {
  league: Pick<League, 'name' | 'year'>;
  week: number;
  transactions: WaiverTransactionWithRelations[];
  sleeperNamesByOwnerId?: Map<string, string>;
};

/**
 * One league's week as Discord embeds - usually one, more only if the week is
 * long enough to risk the description limit.
 */
export function buildWaiverEmbeds({
  league,
  week,
  transactions,
  sleeperNamesByOwnerId = new Map(),
}: BuildWaiverEmbedsArgs): EmbedBuilder[] {
  const title = `${league.name} — Week ${week} Waivers`;
  const color = leagueEmbedColor(league.name);

  if (transactions.length === 0) {
    return [
      new EmbedBuilder()
        .setTitle(title)
        .setColor(color)
        .setDescription('No waiver activity this week.'),
    ];
  }

  const groups = groupByPlayer(transactions);
  const awarded = groups.filter(group => group.winner);
  const unawarded = groups.filter(group => !group.winner);

  const blocks: string[] = [];
  for (const group of awarded) {
    blocks.push(renderGroupLines(group, sleeperNamesByOwnerId).join('\n'));
  }
  if (unawarded.length > 0) {
    blocks.push(
      [
        '**No claim awarded**',
        ...unawarded.flatMap(group =>
          renderGroupLines(group, sleeperNamesByOwnerId),
        ),
      ].join('\n'),
    );
  }

  // Pack blocks into descriptions, never splitting a player's block across two
  // embeds.
  const descriptions: string[] = [];
  let current = '';
  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > MAX_DESCRIPTION_LENGTH && current) {
      descriptions.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }
  if (current) descriptions.push(current);

  const claims = transactions.filter(
    transaction => transaction.status === 'complete',
  );
  const spent = claims.reduce((total, claim) => total + claim.bid, 0);

  return descriptions.map((description, index) => {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(description);

    if (index === 0) {
      embed.setTitle(title);
    } else {
      embed.setTitle(`${title} (cont.)`);
    }

    if (index === descriptions.length - 1) {
      embed.setFooter({
        text: `${claims.length} claim${
          claims.length === 1 ? '' : 's'
        } · $${spent} FAAB spent · ${
          transactions.length - claims.length
        } failed`,
      });
    }

    return embed;
  });
}

/**
 * Sleeper display names for a league, so owners we have never linked still get a
 * name rather than a bare ID.
 */
async function getSleeperNames(sleeperLeagueId: string) {
  try {
    const users = await getLeagueUsers(sleeperLeagueId);
    const names = new Map<string, string>();
    for (const user of users) {
      const name = user.metadata?.team_name || user.display_name;
      if (name) names.set(user.user_id, name);
    }
    return names;
  } catch (error) {
    // A cosmetic fallback; never fail the report over it.
    console.error('Could not load Sleeper display names:', error);
    return new Map<string, string>();
  }
}

export type PostWaiverReportsArgs = {
  year: number;
  /**
   * The report week. Omit only when `batchAfter` is given, in which case the week
   * is read off whichever batch Sleeper actually ran.
   */
  week?: number;
  /**
   * Sync the batch that ran at or after this instant, rather than working from a
   * known week. This is the scheduled job's path.
   */
  batchAfter?: Date;
  /** Roughly which Sleeper week to search when using `batchAfter`. */
  nearWeek?: number;
  /** Lowercase league names. Defaults to all five. */
  leagueNames?: string[];
  /** Repost a league-week that has already been reported. */
  force?: boolean;
  /** Build the embeds without posting to Discord or recording the report. */
  preview?: boolean;
  channelId?: string;
};

export type WaiverReportResult = {
  leagueName: string;
  week?: number;
  status: 'posted' | 'skipped' | 'no-data' | 'preview' | 'error';
  transactionCount: number;
  embeds?: EmbedBuilder[];
  message?: string;
};

/**
 * The one orchestrator behind the scheduled job, the slash command and the admin
 * page.
 *
 * Reports always render from what we have stored, never straight from the Sleeper
 * response. That is the whole reason the claims are persisted: Sleeper drops
 * failed claims from older weeks, so a re-run months later would show a winner
 * with none of the bids it beat. It also means a re-run must not casually
 * re-sync - with `replaceWaiverTransactions`, pulling a pruned week would delete
 * the good rows and put the pruned set in their place. So a sync happens when the
 * caller asks for one, or when the week holds nothing yet and there is therefore
 * nothing to lose.
 */
export async function postWaiverReports({
  year,
  week: requestedWeek,
  batchAfter,
  nearWeek,
  leagueNames,
  force = false,
  preview = false,
  channelId,
}: PostWaiverReportsArgs): Promise<WaiverReportResult[]> {
  const allLeagues = await getLeaguesByYear(year);
  const leagues = allLeagues.filter(league => {
    const name = league.name.toLowerCase();
    if (!isLeagueName(name)) return false;
    return leagueNames ? leagueNames.includes(name) : true;
  });

  if (leagues.length === 0) return [];

  // Read once and share: this walks every member row, so leaving it to each
  // league would run that query five times concurrently.
  const ownerToUserId = await getOwnerToUserIdMap();

  const results: WaiverReportResult[] = [];

  for (const league of leagues) {
    try {
      let week = requestedWeek;

      if (batchAfter) {
        const synced = await syncLeagueWaivers(
          league,
          { since: batchAfter, nearWeek: nearWeek ?? requestedWeek ?? 1 },
          { ownerToUserId },
        );
        if (!synced) {
          results.push({
            leagueName: league.name,
            week,
            status: 'no-data',
            transactionCount: 0,
            message: 'Sleeper has no waiver batch for this week yet.',
          });
          continue;
        }
        week = synced.week;
      }

      if (week === undefined) {
        results.push({
          leagueName: league.name,
          status: 'error',
          transactionCount: 0,
          message: 'No week to report on.',
        });
        continue;
      }

      if (!preview && !force) {
        const existing = await getWaiverReport(league.id, week);
        if (existing) {
          results.push({
            leagueName: league.name,
            week,
            status: 'skipped',
            transactionCount: 0,
            message: 'Already reported for this week.',
          });
          continue;
        }
      }

      let transactions = await getWaiverTransactions(league.id, week);

      // Nothing stored means a sync cannot destroy anything, so it is safe to
      // fill the gap - which is what makes a re-run work for a week the
      // scheduled job never managed to record.
      if (transactions.length === 0 && !batchAfter) {
        const synced = await syncLeagueWaivers(
          league,
          { week },
          { ownerToUserId },
        );
        if (synced) {
          transactions = await getWaiverTransactions(league.id, week);
        }
      }

      if (transactions.length === 0) {
        results.push({
          leagueName: league.name,
          week,
          status: 'no-data',
          transactionCount: 0,
          message: 'No waiver claims stored for this week.',
        });
        continue;
      }

      const sleeperNamesByOwnerId = await getSleeperNames(
        league.sleeperLeagueId,
      );
      const embeds = buildWaiverEmbeds({
        league,
        week,
        transactions,
        sleeperNamesByOwnerId,
      });

      if (preview) {
        results.push({
          leagueName: league.name,
          week,
          status: 'preview',
          transactionCount: transactions.length,
          embeds,
        });
        continue;
      }

      if (!channelId) {
        results.push({
          leagueName: league.name,
          week,
          status: 'error',
          transactionCount: transactions.length,
          message: 'No waiver report channel configured.',
        });
        continue;
      }

      // Split across messages if the week is long enough to clear Discord's
      // per-message embed budget, which it rejects outright rather than
      // trimming. A normal week is one message.
      for (const group of chunkEmbedsForMessages(embeds)) {
        await sendMessageToChannel({
          channelId,
          messageData: {
            embeds: group,
            // Belt and braces: mentions in embeds do not notify, and this stops
            // anything in a name from resolving either.
            allowed_mentions: { parse: [] },
          },
        });
      }
      await recordWaiverReport({ leagueId: league.id, week });

      results.push({
        leagueName: league.name,
        week,
        status: 'posted',
        transactionCount: transactions.length,
      });
    } catch (error) {
      // One league failing should not stop the other four.
      console.error(`Waiver report failed for ${league.name}:`, error);
      results.push({
        leagueName: league.name,
        status: 'error',
        transactionCount: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}
