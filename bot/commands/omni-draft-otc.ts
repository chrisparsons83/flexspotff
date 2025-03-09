import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { DateTime } from 'luxon';
import { getPendingPicksBySeason } from '~/models/omnipick.server';
import { getCurrentOmniSeason } from '~/models/omniseason.server';

const DISPLAY_FIELD = 'display';

export const data = new SlashCommandBuilder()
  .setName('omni-draft-otc')
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
  console.log('omni-draft-otc__execute');
  const ephemeral =
    interaction.options.getString(DISPLAY_FIELD) === 'private' ? true : false;
  await interaction.deferReply({ ephemeral });

  const omniSeason = await getCurrentOmniSeason();
  if (!omniSeason) {
    return interaction.followUp('There is no current active Omni season');
  }

  const openPicks = await getPendingPicksBySeason(omniSeason.id);

  const teamsOTC = [...new Set(openPicks.map(pick => pick.teamId))];

  const embed = new EmbedBuilder()
    .setTitle(`Users currently on the clock`)
    .addFields(
      teamsOTC.map(team => ({
        name:
          openPicks.find(pick => team === pick.teamId)?.team.user
            ?.discordName || '',
        value: openPicks
          .filter(pick => team === pick.teamId)
          .map(pick => {
            if (!pick.pickStartTime) return '';

            const current = DateTime.now();
            const start = DateTime.fromJSDate(pick.pickStartTime);
            const diff = current.diff(start);

            return `#${pick.pickNumber}. ${diff.toFormat('hh:mm:ss')}`;
          })
          .join('\n'),
      })),
    );

  return interaction.editReply({
    embeds: [embed],
  });
};
