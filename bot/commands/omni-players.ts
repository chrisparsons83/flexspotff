import type {
  OmniDraftPick,
  OmniPlayer,
  OmniSport,
  OmniUserTeam,
  User,
} from '@prisma/client';
import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getPlayersAndAssociatedPick } from '~/models/omniplayer.server';
import { getCurrentOmniSeason, getSportById } from '~/models/omnisport.server';
import { SPORTS_LIST } from '~/utils/constants';

export const data = new SlashCommandBuilder()
  .setName('omni-players')
  .setDescription(
    'View all players for a particular Omni sport. Output is hidden.',
  )
  .addStringOption(option =>
    option
      .setName('sport')
      .setDescription('The sport to view the list for')
      .setRequired(true)
      .addChoices(SPORTS_LIST),
  )
  .addBooleanOption(option =>
    option
      .setName('showdrafted')
      .setDescription('Show already drafted players. Defaults to false.')
      .setRequired(false),
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  await interaction.deferReply({ ephemeral: true });

  const omniSeason = await getCurrentOmniSeason();
  if (!omniSeason) {
    return interaction.followUp('There is no current active Omni season');
  }
  const activePlayers = omniSeason
    ? await getPlayersAndAssociatedPick(omniSeason.id)
    : [];

  const showDrafted = Boolean(interaction.options.getBoolean('showdrafted'));
  const inputSport = interaction.options.getString('sport');
  if (!inputSport) {
    return interaction.editReply({
      content: 'No sport provided',
    });
  }

  const sport = await getSportById(inputSport);
  if (!sport) {
    return interaction.editReply({
      content: 'Sport not found',
    });
  }

  const playerList = activePlayers.filter(
    player => player.sportId === inputSport,
  );

  const embed = new EmbedBuilder()
    .setTitle(`Players in ${sport.name}`)
    .setDescription(
      playerList
        .filter(player => showDrafted || !player.draftPick)
        .sort((a, b) => a.relativeSort - b.relativeSort)
        .map(player => playerDisplay(player))
        .join('\n'),
    );

  return interaction.editReply({
    embeds: [embed],
  });
};

const playerDisplay = (
  player: OmniPlayer & {
    sport: OmniSport;
    draftPick:
      | (OmniDraftPick & {
          team: OmniUserTeam & {
            user: User | null;
          };
        })
      | null;
  },
) => {
  if (player.draftPick) {
    return `${player.relativeSort}) ~~${player.displayName}~~ (${player.draftPick.team.user?.discordName})`;
  } else {
    return `${player.relativeSort}) ${player.displayName}`;
  }
};
