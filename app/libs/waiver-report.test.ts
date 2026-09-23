import {
  buildWaiverEmbeds,
  chunkEmbedsForMessages,
  groupByPlayer,
} from './waiver-report.server';
import { EmbedBuilder, embedLength } from 'discord.js';
import { describe, expect, it } from 'vitest';
import type { WaiverTransactionWithRelations } from '~/models/waiver.server';

const OUTBID = 'This player was claimed by another owner.';
const ROSTER_FULL =
  'Unfortunately, your roster will have too many players after this transaction.';

let sequence = 0;

type RowOverrides = Partial<{
  bid: number;
  seq: number;
  status: string;
  notes: string | null;
  addSleeperId: string;
  playerName: string | null;
  discordId: string | null;
  sleeperOwnerId: string;
  dropName: string | null;
}>;

const row = ({
  bid = 1,
  seq = sequence++,
  status = 'failed',
  notes = OUTBID,
  addSleeperId = 'p1',
  playerName = 'Jaylen Wright',
  discordId = '111',
  sleeperOwnerId = 'owner-1',
  dropName = null,
}: RowOverrides = {}): WaiverTransactionWithRelations =>
  ({
    id: `txn-${seq}-${addSleeperId}`,
    bid,
    seq,
    status,
    notes,
    addSleeperId,
    sleeperOwnerId,
    addPlayer: playerName
      ? { fullName: playerName, position: 'RB', nflTeam: 'MIA' }
      : null,
    dropPlayer: dropName ? { fullName: dropName } : null,
    user: discordId ? { discordId, discordName: 'alice' } : null,
  } as unknown as WaiverTransactionWithRelations);

const league = { name: 'Champions', year: 2026 };

const describeOf = (transactions: WaiverTransactionWithRelations[]) =>
  buildWaiverEmbeds({ league, week: 3, transactions })
    .map(embed => embed.data.description ?? '')
    .join('\n\n');

describe('groupByPlayer', () => {
  it('puts the winner first and the losers in bid order', () => {
    const groups = groupByPlayer([
      row({ bid: 12, status: 'failed' }),
      row({ bid: 34, status: 'complete', notes: null }),
      row({ bid: 28, status: 'failed' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].winner?.bid).toBe(34);
    expect(groups[0].losers.map(loser => loser.bid)).toEqual([28, 12]);
  });

  /**
   * Sleeper breaks a tied bid on waiver priority, where the lower seq wins. The
   * real DET group in the week 3 fixture is a complete $4/seq 7 above failed
   * bids of $2, $1 and $0.
   */
  it('breaks a tied bid on seq, lower first', () => {
    const groups = groupByPlayer([
      row({ bid: 5, seq: 9, status: 'failed' }),
      row({ bid: 5, seq: 2, status: 'complete', notes: null }),
    ]);

    expect(groups[0].winner?.seq).toBe(2);
    expect(groups[0].losers[0].seq).toBe(9);
  });

  it('separates players by the key that was added', () => {
    const groups = groupByPlayer([
      row({ addSleeperId: 'p1', bid: 3, status: 'complete', notes: null }),
      row({ addSleeperId: 'DET', bid: 4, status: 'complete', notes: null }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it('leaves a group with no winner when every bid failed', () => {
    const groups = groupByPlayer([
      row({ bid: 3, status: 'failed', notes: ROSTER_FULL }),
    ]);

    expect(groups[0].winner).toBeUndefined();
    expect(groups[0].losers).toHaveLength(1);
  });
});

describe('buildWaiverEmbeds', () => {
  it('renders a mention for a linked member', () => {
    const description = describeOf([
      row({ bid: 34, status: 'complete', notes: null, discordId: '999' }),
    ]);

    expect(description).toContain('<@999>');
  });

  /**
   * A mention inside an embed renders as a name chip without notifying, which is
   * the whole point; an owner we cannot resolve has no ID to mention, so their
   * Sleeper name goes in as plain text rather than the claim disappearing.
   */
  it('falls back to a Sleeper display name for an unlinked owner', () => {
    const embeds = buildWaiverEmbeds({
      league,
      week: 3,
      transactions: [
        row({
          bid: 9,
          status: 'complete',
          notes: null,
          discordId: null,
          sleeperOwnerId: 'owner-x',
        }),
      ],
      sleeperNamesByOwnerId: new Map([['owner-x', 'SomeManager']]),
    });
    const description = embeds[0].data.description ?? '';

    expect(description).toContain('SomeManager');
    expect(description).not.toContain('<@');
  });

  it('distinguishes an outbid loss from a roster-size failure', () => {
    const description = describeOf([
      row({ bid: 34, status: 'complete', notes: null }),
      row({ bid: 28, status: 'failed', notes: OUTBID }),
      row({ bid: 40, status: 'failed', notes: ROSTER_FULL }),
    ]);

    expect(description).toContain('❌ $28');
    expect(description).toContain('⚠️ $40');
    // Sleeper's own wording is a full sentence and repeats all week.
    expect(description).toContain('roster full');
    expect(description).not.toContain('too many players');
  });

  it('shortens every failure note Sleeper actually sends', () => {
    const description = describeOf([
      row({ addSleeperId: 'p1', bid: 9, status: 'complete', notes: null }),
      row({
        addSleeperId: 'p1',
        bid: 8,
        status: 'failed',
        notes: 'You are over the budget for this transaction.',
      }),
      row({
        addSleeperId: 'p1',
        bid: 7,
        status: 'failed',
        notes:
          'One of the players you are trying to drop has already started playing.',
      }),
    ]);

    expect(description).toContain('over budget');
    expect(description).toContain('drop already played');
  });

  it('falls through to Sleeper wording for an unrecognised failure', () => {
    const description = describeOf([
      row({ bid: 5, status: 'complete', notes: null }),
      row({
        bid: 3,
        status: 'failed',
        notes: 'Some brand new Sleeper reason.',
      }),
    ]);

    expect(description).toContain('Some brand new Sleeper reason.');
  });

  it('leaves out players nobody won, since Sleeper does not show those bids', () => {
    const embeds = buildWaiverEmbeds({
      league,
      week: 3,
      transactions: [
        row({ addSleeperId: 'p1', bid: 5, status: 'complete', notes: null }),
        row({
          addSleeperId: 'p2',
          playerName: 'Tank Dell',
          bid: 3,
          status: 'failed',
          notes: ROSTER_FULL,
        }),
      ],
    });
    const description = embeds.map(embed => embed.data.description).join('\n');
    const footer = embeds[embeds.length - 1].data.footer?.text ?? '';

    expect(description).toContain('Jaylen Wright');
    expect(description).not.toContain('Tank Dell');
    expect(description).not.toContain('$3');
    // The count would give the hidden bids away too.
    expect(footer).toContain('0 failed');
  });

  it('says no claims were awarded when every bid failed', () => {
    const embeds = buildWaiverEmbeds({
      league,
      week: 3,
      transactions: [row({ bid: 3, status: 'failed', notes: ROSTER_FULL })],
    });

    expect(embeds).toHaveLength(1);
    expect(embeds[0].data.description).toBe('No claims awarded this week.');
  });

  it('shows the dropped player alongside a winning claim', () => {
    const description = describeOf([
      row({
        bid: 4,
        status: 'complete',
        notes: null,
        dropName: 'Justice Hill',
      }),
    ]);

    expect(description).toContain('dropped Justice Hill');
  });

  it('shows a raw Sleeper key when the player is not in our table', () => {
    const description = describeOf([
      row({
        bid: 4,
        status: 'complete',
        notes: null,
        playerName: null,
        addSleeperId: '99999',
      }),
    ]);

    expect(description).toContain('99999');
  });

  it('totals claims and FAAB in the footer, ignoring failed bids', () => {
    const embeds = buildWaiverEmbeds({
      league,
      week: 3,
      transactions: [
        row({ addSleeperId: 'p1', bid: 34, status: 'complete', notes: null }),
        row({ addSleeperId: 'p2', bid: 7, status: 'complete', notes: null }),
        row({ addSleeperId: 'p1', bid: 28, status: 'failed' }),
      ],
    });
    const footer = embeds[embeds.length - 1].data.footer?.text ?? '';

    expect(footer).toContain('2 claims');
    expect(footer).toContain('$41');
    expect(footer).toContain('1 failed');
  });

  it('says so when a league had no waiver activity', () => {
    const embeds = buildWaiverEmbeds({ league, week: 3, transactions: [] });

    expect(embeds).toHaveLength(1);
    expect(embeds[0].data.description).toContain('No waiver activity');
  });

  it('titles and colours the embed by league', () => {
    const embeds = buildWaiverEmbeds({
      league,
      week: 3,
      transactions: [row({ bid: 1, status: 'complete', notes: null })],
    });

    expect(embeds[0].data.title).toBe('Champions — Week 3 Waivers');
    expect(embeds[0].data.color).toBe(0xc29f04);
  });

  it('splits a long week across embeds rather than truncating', () => {
    const transactions = Array.from({ length: 120 }, (_, index) =>
      row({
        addSleeperId: `player-${index}`,
        playerName: `A Very Long Player Name Number ${index}`,
        bid: index,
        status: 'complete',
        notes: null,
      }),
    );

    const embeds = buildWaiverEmbeds({ league, week: 3, transactions });

    expect(embeds.length).toBeGreaterThan(1);
    for (const embed of embeds) {
      expect((embed.data.description ?? '').length).toBeLessThanOrEqual(4096);
    }
    // Only the last embed carries the footer, and every player still appears.
    expect(embeds[embeds.length - 1].data.footer?.text).toContain('120 claims');
    const all = embeds.map(e => e.data.description).join('');
    expect(all).toContain('Number 0');
    expect(all).toContain('Number 119');
  });
});

describe('chunkEmbedsForMessages', () => {
  const embedOf = (chars: number) =>
    new EmbedBuilder().setDescription('x'.repeat(chars));

  const charsIn = (group: EmbedBuilder[]) =>
    group.reduce((total, embed) => total + embedLength(embed.data), 0);

  it('keeps a normal week in a single message', () => {
    const groups = chunkEmbedsForMessages([embedOf(500), embedOf(500)]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  /**
   * The bug this exists for. A five-league preview of 2025 week 2 came to 6235
   * characters, and Discord rejects the whole message at 6000 rather than
   * trimming it - so the command failed outright with 50035.
   */
  it('splits when the total would exceed the message budget', () => {
    const groups = chunkEmbedsForMessages([
      embedOf(1218),
      embedOf(1526),
      embedOf(1600),
      embedOf(1020),
      embedOf(871),
    ]);

    expect(groups.length).toBeGreaterThan(1);
    for (const group of groups) {
      expect(charsIn(group)).toBeLessThanOrEqual(6000);
    }
  });

  it('never puts more than ten embeds in a message', () => {
    const groups = chunkEmbedsForMessages(
      Array.from({ length: 25 }, () => embedOf(10)),
    );

    expect(groups).toHaveLength(3);
    for (const group of groups) {
      expect(group.length).toBeLessThanOrEqual(10);
    }
  });

  it('keeps every embed rather than dropping any', () => {
    const embeds = Array.from({ length: 25 }, (_, index) =>
      new EmbedBuilder().setDescription(`embed ${index}`),
    );

    const flattened = chunkEmbedsForMessages(embeds).flat();

    expect(flattened).toHaveLength(25);
    expect(flattened.map(embed => embed.data.description)).toEqual(
      embeds.map(embed => embed.data.description),
    );
  });

  it('gives an oversized embed its own message rather than dropping it', () => {
    const groups = chunkEmbedsForMessages([embedOf(100), embedOf(4000)]);

    expect(groups.flat()).toHaveLength(2);
  });

  it('handles an empty list', () => {
    expect(chunkEmbedsForMessages([])).toEqual([]);
  });
});
