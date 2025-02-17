import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  TextChannel,
} from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
} from 'discord.js';
import type { OmniDraftPick } from '~/models/omnipick.server';
import {
  getNextOmniPickForTeam,
  getPickByPickNumber,
  updateDraftPick,
  updateDraftPickTimeByPickNumber,
} from '~/models/omnipick.server';
import { getPlayersAndAssociatedPick } from '~/models/omniplayer.server';
import { getCurrentOmniSeason } from '~/models/omniseason.server';
import { getActiveSports } from '~/models/omnisport.server';
import type { OmniUserTeam } from '~/models/omniuserteam.server';
import { getOmniUserTeamByUserIdAndSeason } from '~/models/omniuserteam.server';
import type { User } from '~/models/user.server';
import { getUserByDiscordId } from '~/models/user.server';

const omniSeason = await getCurrentOmniSeason();
const activeSports = await getActiveSports();
const activePlayers = omniSeason
  ? await getPlayersAndAssociatedPick(omniSeason.id)
  : [];

export const data = new SlashCommandBuilder()
  .setName('omni-make-pick')
  .setDescription('Make a draft pick in the currently running Omni draft')
  .addStringOption(option =>
    option
      .setName('sport')
      .setDescription('The sport you are making a pick for')
      .setRequired(true)
      .addChoices(
        activeSports
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(sport => ({
            name: sport.name,
            value: sport.id,
          })),
      ),
  )
  .addStringOption(option =>
    option
      .setName('pick')
      .setDescription('Your draft selection')
      .setRequired(true)
      .setAutocomplete(true),
  );

export const autocomplete = async (interaction: AutocompleteInteraction) => {
  const options = interaction.options.getString('sport') || '';

  if (options === '') {
    await interaction.respond([]);
  }
  interaction.respond(
    activePlayers
      .filter(player => player.sportId === options)
      .filter(player => player.draftPick === null)
      .sort((a, b) => a.relativeSort - b.relativeSort)
      .slice(0, 25)
      .map(player => ({ name: player.displayName, value: player.id })),
  );
};

export const execute = async (interaction: ChatInputCommandInteraction) => {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.options.getUser('user')?.id || interaction.user.id;

  const flexspotUser = await getUserByDiscordId(userId);
  if (!flexspotUser) {
    return interaction.editReply(
      'You have not been added to the backend database by Chris, bug him to fix this.',
    );
  }

  const omniSeason = await getCurrentOmniSeason();
  if (!omniSeason) {
    return interaction.editReply('There is no current active Omni season');
  }

  const omniUserTeam = await getOmniUserTeamByUserIdAndSeason(
    omniSeason.id,
    flexspotUser.id,
  );
  if (!omniUserTeam) {
    return interaction.editReply(
      'You have not been added to the current Omni season',
    );
  }

  const nextPickFromTeam = await getNextOmniPickForTeam(omniUserTeam.id);
  if (!nextPickFromTeam) {
    return interaction.editReply('It is not your turn to pick');
  }

  // At this point we know we have a valid pick, so we can try to confirm it.
  const confirm = new ButtonBuilder()
    .setCustomId('confirm')
    .setLabel('Make Selection')
    .setStyle(ButtonStyle.Primary);
  const cancel = new ButtonBuilder()
    .setCustomId('cancel')
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    cancel,
    confirm,
  );

  const inputSport = interaction.options.getString('sport');
  const inputPlayer = interaction.options.getString('pick');

  const player = activePlayers.find(p => p.id === inputPlayer);
  if (!player) {
    return interaction.editReply('Invalid player selection');
  }
  const sport = activeSports.find(s => s.id === inputSport);
  if (!sport) {
    return interaction.editReply('Invalid sport selection');
  }

  const response = await interaction.followUp({
    content: `You are about to select ${player?.displayName} in ${sport?.name}. Are you sure you want to make this pick?`,
    components: [row],
    fetchReply: true,
    ephemeral: true,
  });

  const collectorFilter = (i: { user: { id: string } }) =>
    i.user.id === interaction.user.id;
  try {
    const confirmation = await response.awaitMessageComponent({
      filter: collectorFilter,
      time: 60_000,
    });

    if (confirmation.customId === 'confirm') {
      await updateDraftPick(nextPickFromTeam.id, player.id);
      const pickNumber = nextPickFromTeam.pickNumber;
      const nextPicks: (OmniDraftPick & {
        team: OmniUserTeam & {
          user: User | null;
        };
      })[] = [];
      for (let i = 1; i < 6; i++) {
        const now = new Date();
        now.setHours(now.getHours() + 12 * i);
        const pickInfo = await getPickByPickNumber(pickNumber + i);
        if (pickInfo) {
          nextPicks.push(pickInfo);
        }
        await updateDraftPickTimeByPickNumber(pickNumber + i, now);
      }
      await confirmation.update({
        content: `Your pick has been entered.`,
        components: [],
      });
      console.log({ nextPicks });
      if (!interaction.channel) {
        return interaction.editReply('Could not find channel');
      }
      const channel = await interaction.client.channels.fetch(
        interaction.channel.id,
      );
      if (!channel) {
        return interaction.editReply('Could not find channel');
      }
      // TODO: This is a TS error because the type of channel is not guaranteed to be a TextChannel
      await (channel as TextChannel).send({
        content: `${interaction.user} has selected ${player?.displayName} from ${sport?.name}. Currently on the clock is <@${nextPicks[0].team.user?.discordId}>. On deck is <@${nextPicks[1].team.user?.discordId}>`,
      });
    } else if (confirmation.customId === 'cancel') {
      await confirmation.update({
        content: 'Action cancelled',
        components: [],
      });
    }
  } catch {
    await interaction.editReply({
      content: 'Confirmation not received within 1 minute, cancelling',
      components: [],
    });
  }
};
