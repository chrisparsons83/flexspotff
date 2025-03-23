import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getOmniSeason, getOmniStandings } from '~/models/omniseason.server';
import { OMNI_YEAR } from '~/utils/constants';

const DISPLAY_FIELD = 'display';

export const data = new SlashCommandBuilder()
  .setName('omni-standings')
  .setDescription(`View current Omni standings.`)
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

  const omniSeason = await getOmniSeason(OMNI_YEAR);
  if (!omniSeason) {
    return interaction.followUp('There is no current active Omni season');
  }

  const leaderboard = getOmniStandings(omniSeason);

  const embed = new EmbedBuilder()
    .setTitle(`Current Leaderboard`)
    .setDescription(
      `${leaderboard
        .map(
          position =>
            `${position.rank}) ${
              position.owner
            } - ${position.totalPoints.toFixed(0)} points`,
        )
        .join('\n')}`,
    );

  return interaction.editReply({
    embeds: [embed],
  });
};
