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
  getLatestPickMade,
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

export const data = new SlashCommandBuilder()
  .setName('omni-make-pick')
  .setDescription('Make a draft pick in the currently running Omni draft')
  .addStringOption(option =>
    option
      .setName('sport')
      .setDescription('The sport you are making a pick for')
      .setRequired(true)
      .addChoices(
        // TODO: Make this dynamic, this is only happening because Chris is doing this at 1am.
        [
          {
            id: 'golfm',
            name: 'Golf - Mens',
          },
          {
            id: 'golfw',
            name: 'Golf - Womens',
          },
          {
            id: 'tennism',
            name: 'Tennis - Mens',
          },
          {
            id: 'tennisw',
            name: 'Tennis - Womens',
          },
          {
            id: 'mlb',
            name: 'MLB',
          },
          {
            id: 'nhl',
            name: 'NHL',
          },
          {
            id: 'nba',
            name: 'NBA',
          },
          {
            id: 'nfl',
            name: 'NFL',
          },
          {
            id: 'ncaam',
            name: 'NCAA Basketball - Mens',
          },
          {
            id: 'ncaaw',
            name: 'NCAA Basketball - Womens',
          },
          {
            id: 'ncaaf',
            name: 'NCAA Football',
          },
          {
            id: 'lol',
            name: 'LoL World Championship',
          },
          {
            id: 'darts',
            name: 'PDC Darts World Championship',
          },
          {
            id: 'ncaalm',
            name: 'NCAA Lacrosse - Mens',
          },
          {
            id: 'nascar',
            name: 'NASCAR',
          },
          {
            id: 'f1',
            name: 'F1',
          },
          {
            id: 'mls',
            name: 'MLS',
          },
          {
            id: 'uefa',
            name: 'UEFA Champions League',
          },
          {
            id: 'afl',
            name: 'Aussie Rules AFL Premiership',
          },
        ]
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
  const omniSeason = await getCurrentOmniSeason();
  const activePlayers = omniSeason
    ? await getPlayersAndAssociatedPick(omniSeason.id)
    : [];

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
  const activeSports = await getActiveSports();
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.options.getUser('user')?.id || interaction.user.id;

  const flexspotUser = await getUserByDiscordId(userId);
  if (!flexspotUser) {
    return interaction.followUp(
      'You have not been added to the backend database by Chris, bug him to fix this.',
    );
  }

  const omniSeason = await getCurrentOmniSeason();
  if (!omniSeason) {
    return interaction.followUp('There is no current active Omni season');
  }
  const activePlayers = omniSeason
    ? await getPlayersAndAssociatedPick(omniSeason.id)
    : [];

  const omniUserTeam = await getOmniUserTeamByUserIdAndSeason(
    omniSeason.id,
    flexspotUser.id,
  );
  if (!omniUserTeam) {
    return interaction.followUp(
      'You have not been added to the current Omni season',
    );
  }

  const nextPickFromTeam = await getNextOmniPickForTeam(omniUserTeam.id);
  if (!nextPickFromTeam) {
    return interaction.followUp('It is not your turn to pick');
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
    return interaction.followUp('Invalid player selection');
  }
  const sport = activeSports.find(s => s.id === inputSport);
  if (!sport) {
    return interaction.followUp('Invalid sport selection');
  }

  const response = await interaction.followUp({
    content: `You are about to select ${player?.displayName} in ${sport?.name}. Are you sure you want to make this pick?`,
    components: [row],
    fetchReply: true,
    ephemeral: true,
  });

  console.log({ interaction });

  const collectorFilter = (i: { user: { id: string } }) =>
    i.user.id === interaction.user.id;
  try {
    const confirmation = await response.awaitMessageComponent({
      filter: collectorFilter,
      time: 60_000,
    });

    await confirmation.deferReply({ ephemeral: true });

    console.log({ confirmation });

    if (confirmation.customId === 'confirm') {
      await updateDraftPick(nextPickFromTeam.id, player.id);
      const furthestAlongPick = await getLatestPickMade();
      const pickNumber = nextPickFromTeam.pickNumber;
      const nextPicks: (OmniDraftPick & {
        team: OmniUserTeam & {
          user: User | null;
        };
      })[] = [];

      // If this is currently the newest pick (IE the person hasn't been skipped, update pick clocks)
      if (furthestAlongPick?.pickNumber === pickNumber) {
        for (let i = 1; i < 6; i++) {
          const now = new Date();
          now.setHours(now.getHours() + 12 * (i - 1));
          const pickInfo = await getPickByPickNumber(pickNumber + i);
          if (pickInfo) {
            nextPicks.push(pickInfo);
          }
          await updateDraftPickTimeByPickNumber(pickNumber + i, now);
        }
      }

      await confirmation.followUp({
        content: `Your pick has been entered.`,
        components: [],
      });
      if (!interaction.channel) {
        return interaction.followUp('Could not find channel');
      }
      const channel = await interaction.client.channels.fetch(
        interaction.channel.id,
      );
      if (!channel) {
        return interaction.followUp('Could not find channel');
      }
      // TODO: This is a TS error because the type of channel is not guaranteed to be a TextChannel
      if (furthestAlongPick?.pickNumber !== pickNumber) {
        await (channel as TextChannel).send({
          content: `${interaction.user} has selected ${player?.displayName} from ${sport?.name}. Since this pick was catching up on out of order, no clock updates were made.`,
        });
      } else {
        const pickTimer = new Date();
        pickTimer.setHours(pickTimer.getHours() + 12);
        await (channel as TextChannel).send({
          content: `${interaction.user} has selected ${
            player?.displayName
          } from ${sport?.name}. Currently on the clock is <@${
            nextPicks[0].team.user?.discordId
          }> and their pick timer expires <t:${parseInt(
            (pickTimer.getTime() / 1000).toFixed(0),
          )}:R>. On deck is <@${nextPicks[1].team.user?.discordId}>`,
        });
      }
    } else if (confirmation.customId === 'cancel') {
      await confirmation.followUp({
        content: 'Action cancelled',
        components: [],
      });
    }
  } catch (e) {
    console.error(e);
    await interaction.followUp({
      content: 'Confirmation not received within 1 minute, cancelling',
      components: [],
    });
  }
};
