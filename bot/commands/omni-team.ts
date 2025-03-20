import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getCurrentOmniSeason } from '~/models/omniseason.server';
import { getActiveSports } from '~/models/omnisport.server';
import { getOmniUserTeamByUserIdAndSeason } from '~/models/omniuserteam.server';
import { getUserByDiscordId } from '~/models/user.server';

export const data = new SlashCommandBuilder()
  .setName('omni-team')
  .setDescription(`View a user's Omni team.`)
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to view.')
      .setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName('hidden')
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
  console.log('omni-team__execute');
  const ephemeral =
    interaction.options.getString('hidden') === 'private' ? true : false;
  await interaction.deferReply({ ephemeral });

  const user = interaction.options.getUser('user');
  if (!user) {
    return interaction.editReply({
      content: 'User not found.',
    });
  }

  const flexspotUser = await getUserByDiscordId(user.id);
  if (!flexspotUser) {
    return interaction.followUp('This user is not registered for Omni.');
  }

  const season = await getCurrentOmniSeason();
  if (!season) {
    return interaction.editReply({
      content: 'No current Omni season found.',
    });
  }

  const omniTeam = await getOmniUserTeamByUserIdAndSeason(
    season.id,
    flexspotUser.id,
  );
  if (!omniTeam) {
    return interaction.editReply({
      content: 'No Omni team found for this user.',
    });
  }

  const sports = await getActiveSports();

  const totalPoints = omniTeam.draftPicks.reduce((acc, pick) => acc + (pick.player?.pointsScored || 0), 0)

  const embed = new EmbedBuilder()
    .setTitle(`${user.username}'s Omni Team`)
    .setDescription(`Current points: ${totalPoints.toFixed(0)}`)
    .addFields(
      [{
        name: `Active`,
        value: omniTeam.draftPicks
          .sort((a, b) => (a.player?.sport.name || '').toLocaleCompare(b.player?.sport.name || ''))
          .filter(pick => !pick.player?.isComplete)
          .map((pick) => `${pick.player?.sport.emoji} ${pick.player?.displayName} (${pick.player?.pointsScored})`)
          .join('\n') || '',
      },{
        name: `Completed`,
        value: omniTeam.draftPicks
          .sort((a, b) => (a.player?.sport.name || '').toLocaleCompare(b.player?.sport.name || ''))
          .filter(pick => pick.player?.isComplete)
          .map((pick) => `${pick.player?.sport.emoji} ${pick.player?.displayName} (${pick.player?.pointsScored})`)
          .join('\n') || '',
      }]
    );

  return interaction.editReply({
    embeds: [embed],
  });
};
