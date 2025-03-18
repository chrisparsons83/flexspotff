import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getPlayersAndAssociatedPick } from '~/models/omniplayer.server';
import {
  getActiveSports,
  getCurrentOmniSeason,
} from '~/models/omnisport.server';

export const data = new SlashCommandBuilder()
  .setName('omni-sport-counts')
  .setDescription(
    'View count of players drafted per sport. Message displays hidden.',
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  console.log('omni-sport-count__execute');
  await interaction.deferReply({ ephemeral: true });

  const sports = await getActiveSports();

  const omniSeason = await getCurrentOmniSeason();
  if (!omniSeason) {
    return interaction.followUp('There is no current active Omni season');
  }
  const activePlayers = omniSeason
    ? await getPlayersAndAssociatedPick(omniSeason.id)
    : [];

  const sportCount = activePlayers
    .filter(player => player.draftPick)
    .reduce((map, cur) => {
      map.set(cur.sportId, (map.get(cur.sportId) || 0) + 1);
      return map;
    }, new Map<string, number>());

  const embed = new EmbedBuilder()
    .setTitle(`Players Drafted by Sport`)
    .setDescription(
      sports
        .map(sport => {
          return `${sport.name}: ${sportCount.get(sport.id) || 0}`;
        })
        .join('\n'),
    );

  return interaction.editReply({
    embeds: [embed],
  });
};
