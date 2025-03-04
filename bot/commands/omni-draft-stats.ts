import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Duration, DateTime } from 'luxon';
import { getPlayersAndAssociatedPick } from '~/models/omniplayer.server';
import { getCurrentOmniSeason } from '~/models/omniseason.server';

const DISPLAY_FIELD = 'display';

export const data = new SlashCommandBuilder()
  .setName('omni-draft-stats')
  .setDescription(`View time stats on this draft.`)
  .addStringOption(option =>
    option
      .setName(DISPLAY_FIELD)
      .setDescription(
        'Private to just display for you, public posts the team in public chat for everyone to see.',
      )
      .setRequired(true)
      .addChoices([
        { name: 'Private', value: 'private' },
        { name: 'Public', value: 'public' },
      ]),
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const ephemeral =
    interaction.options.getString(DISPLAY_FIELD) === 'private' ? true : false;
  await interaction.deferReply({ ephemeral });

  const omniSeason = await getCurrentOmniSeason();
  if (!omniSeason) {
    return interaction.followUp('There is no current active Omni season');
  }
  const activePlayers = omniSeason
    ? await getPlayersAndAssociatedPick(omniSeason.id)
    : [];

  const pickTimeTable = activePlayers
    .filter(player => player.draftPick)
    .reduce((map, cur) => {
      if (
        !cur.draftPick ||
        !cur.draftPick.pickMadeTime ||
        !cur.draftPick.pickStartTime ||
        !cur.draftPick.team.user
      )
        return map;
      const diff = DateTime.fromJSDate(cur.draftPick.pickMadeTime).diff(
        DateTime.fromJSDate(cur.draftPick.pickStartTime),
      );
      const existingValue = map.get(cur.draftPick.team.user.discordName) || [];
      existingValue.push([cur.draftPick.pickNumber, diff]);
      map.set(cur.draftPick.team.user.discordName, existingValue);
      return map;
    }, new Map<string, [number, Duration<true> | Duration<false>][]>());

  const pickStats = [...pickTimeTable].map(([player, value]) => {
    value.sort((a, b) => a[1].as('milliseconds') - b[1].as('milliseconds'));
    const total = value.reduce((acc, cur) => {
      return acc + cur[1].as('milliseconds');
    }, 0);
    return {
      name: player,
      min: value[0],
      max: value[value.length - 1],
      happyMedian: getMedian(value),
      total,
      average: Math.floor(total / value.length),
    };
  });

  const embed = new EmbedBuilder().setTitle(`Draft Time Stats`).addFields(
    pickStats
      .sort((a, b) => a.total - b.total)
      .map(pickStat => ({
        name: trimWithEllipsis(pickStat.name),
        value: `Total: ${Duration.fromMillis(pickStat.total).toFormat(
          'hh:mm:ss',
        )}\nFastest: ${pickStat.min[1].toFormat(
          'hh:mm:ss',
        )}\nSlowest: ${pickStat.max[1].toFormat(
          'hh:mm:ss',
        )}\nAverage: ${Duration.fromMillis(pickStat.average).toFormat(
          'hh:mm:ss',
        )}\nMedian: ${pickStat.happyMedian[1].toFormat('hh:mm:ss')}`,
        inline: true,
      })),
  );

  return interaction.editReply({
    embeds: [embed],
  });
};

const getMedian = (arr: [number, Duration<true> | Duration<false>][]) => {
  const mid = Math.floor(arr.length / 2);

  return arr.length % 2 !== 0
    ? arr[mid] // Odd-length array: return middle element
    : arr[mid - 1]; // Even-length: average of middle two
};

const trimWithEllipsis = (str: string, maxLength = 17) => {
  return str.length > maxLength ? str.slice(0, maxLength - 3) + '...' : str;
};
