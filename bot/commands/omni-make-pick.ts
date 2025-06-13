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
import {
  getOmniUserTeamByUserIdAndSeason,
  getOmniUserTeamsBySeason,
} from '~/models/omniuserteam.server';
import type { User } from '~/models/user.server';
import { getUserByDiscordId } from '~/models/user.server';
import { SPORTS_LIST } from '~/utils/constants';

export const data = new SlashCommandBuilder()
  .setName('omni-make-pick')
  .setDescription('Make a draft pick in the currently running Omni draft')
  .addStringOption(option =>
    option
      .setName('sport')
      .setDescription('The sport you are making a pick for')
      .setRequired(true)
      .addChoices(SPORTS_LIST),
  )
  .addStringOption(option =>
    option
      .setName('pick')
      .setDescription('Your draft selection')
      .setRequired(true)
      .setAutocomplete(true),
  );

export const autocomplete = async (interaction: AutocompleteInteraction) => {
  console.log('omni-make-pick__autocomplete');
  const options = interaction.options.getString('sport') || '';

  if (options === '') {
    await interaction.respond([]);
  } else {
    const omniSeason = await getCurrentOmniSeason();
    const activePlayers = omniSeason
      ? await getPlayersAndAssociatedPick(omniSeason.id)
      : [];

    const focusedValue = interaction.options.getFocused().toLocaleLowerCase();

    try {
      interaction.respond(
        activePlayers
          .filter(player => player.sportId === options)
          .filter(player => player.draftPick === null)
          .filter(player =>
            player.displayName.toLocaleLowerCase().startsWith(focusedValue),
          )
          .sort((a, b) => a.relativeSort - b.relativeSort)
          .slice(0, 25)
          .map(player => ({ name: player.displayName, value: player.id })),
      );
    } catch (e) {
      console.error(e);
    }
  }
};

export const execute = async (interaction: ChatInputCommandInteraction) => {
  console.log('omni-make-pick__execute');
  await interaction.deferReply({ ephemeral: true });
  const activeSports = await getActiveSports();

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

  // Get all the sports you've picked already and the number of picks.
  const currentSportPicks = omniUserTeam.draftPicks
    .filter(p => p.player)
    .map(p => p.player?.sportId);
  const currentUniqueSportPicks = new Set(currentSportPicks);

  // Add the current pick so we have an accurate state at where we'd be.
  if (inputSport) {
    currentSportPicks.push(inputSport);
    currentUniqueSportPicks.add(inputSport);
  }

  // Count number of flex spots used already - if you're at the max, you can't pick another flex
  if (currentSportPicks.length - currentUniqueSportPicks.size > 5) {
    return interaction.followUp(
      `You have filled your flex spots. Please choose from one of the following sports: ${activeSports
        .filter(
          sport => !currentSportPicks.filter(String).includes(sport.id || ''),
        )
        .map(sport => sport.name)
        .join(', ')}`,
    );
  }

  const player = activePlayers.find(p => p.id === inputPlayer);
  if (!player) {
    return interaction.followUp('Invalid player selection');
  }
  const sport = activeSports.find(s => s.id === inputSport);
  if (!sport) {
    return interaction.followUp('Invalid sport selection');
  }

  // Map out how many people have picked from inputSport players already, add the current pick in
  // there, and then fill in a single pick for all players that haven't drafted. If that number is
  // greater than the number of players in the pool, then this is an invalid pick because someone
  // would not be able to make a pick.
  const teamsPickedSport = new Set(
    activePlayers
      .filter(p => p.sportId === inputSport && p.draftPick)
      .map(p => p.draftPick?.teamId),
  );
  teamsPickedSport.add(omniUserTeam.id);
  const totalTeams = (await getOmniUserTeamsBySeason(omniSeason.id)).length;
  const teamsWithoutSport = totalTeams - teamsPickedSport.size;
  // Subtract 1 for the player about to be taken
  const remainingPlayers =
    activePlayers.filter(p => p.sportId === inputSport && !p.draftPick).length -
    1;
  if (teamsWithoutSport > remainingPlayers) {
    return interaction.followUp(
      `There are not enough teams left to pick from ${sport.name}`,
    );
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

    await confirmation.deferReply({ ephemeral: true });

    if (confirmation.customId === 'confirm') {
      // We need to check the next pick again because there could be duplicate picks submitted at once, thanks Allen.
      const currentNextPickFromTeam = await getNextOmniPickForTeam(
        omniUserTeam.id,
      );
      if (!currentNextPickFromTeam) {
        return interaction.followUp('It is not your turn to pick');
      }

      await updateDraftPick(currentNextPickFromTeam.id, player.id);
      const furthestAlongPick = await getLatestPickMade();
      const pickNumber = currentNextPickFromTeam.pickNumber;
      const nextPicks: (OmniDraftPick & {
        team: OmniUserTeam & {
          user: User | null;
        };
      })[] = [];

      const lengthOfPause =
        (omniSeason.pauseEndHour || 0) - (omniSeason.pauseStartHour || 0);

      // If this is currently the newest pick (IE the person hasn't been skipped, update pick clocks)
      if (furthestAlongPick?.pickNumber === pickNumber) {
        const nextPick = new Date();

        // if we're currently in the pause window, then set the clock to the end of the pause
        if (
          omniSeason.hasOvernightPause &&
          omniSeason.pauseStartHour &&
          omniSeason.pauseEndHour &&
          nextPick.getUTCHours() >= omniSeason.pauseStartHour &&
          nextPick.getUTCHours() < omniSeason.pauseEndHour
        ) {
          nextPick.setUTCHours(
            omniSeason.pauseEndHour + omniSeason.hoursPerPick,
          );
          nextPick.setMinutes(0);
          nextPick.setSeconds(0);
        }

        for (let i = 1; i < 6; i++) {
          const pickInfo = await getPickByPickNumber(pickNumber + i);
          if (pickInfo) {
            nextPicks.push({ ...pickInfo, pickStartTime: nextPick });
          }
          await updateDraftPickTimeByPickNumber(pickNumber + i, nextPick);
          nextPick.setUTCHours(
            nextPick.getUTCHours() + omniSeason.hoursPerPick,
          );
          // if this falls into the pause window, then we need to bump it up by the amount of time in the pause
          if (
            omniSeason.hasOvernightPause &&
            omniSeason.pauseStartHour &&
            omniSeason.pauseEndHour &&
            nextPick.getUTCHours() >= omniSeason.pauseStartHour &&
            nextPick.getUTCHours() < omniSeason.pauseEndHour
          ) {
            nextPick.setUTCHours(nextPick.getUTCHours() + lengthOfPause);
          }
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
        const nextPick = await getPickByPickNumber(pickNumber + 2);
        const nextToNextPick = await getPickByPickNumber(pickNumber + 2);
        if (!nextPick) {
          await (channel as TextChannel).send({
            content: `${interaction.user} has selected ${player?.displayName} from ${sport?.name}. This draft has completed. Go hug your children or something.`,
          });
        } else if (!nextToNextPick) {
          const fakeClock = new Date();
          fakeClock.setHours(fakeClock.getHours() + 4);
          await (channel as TextChannel).send({
            content: `${interaction.user} has selected ${
              player?.displayName
            } from ${sport?.name}. Currently on the clock is <@${
              nextPicks[0].team.user?.discordId
            }> and their pick timer expires <t:${parseInt(
              (fakeClock.getTime() / 1000).toFixed(0),
            )}:R>.`,
          });
        } else {
          await (channel as TextChannel).send({
            content: `${interaction.user} has selected ${
              player?.displayName
            } from ${sport?.name}. Currently on the clock is <@${
              nextPicks[0].team.user?.discordId
            }> and their pick timer expires <t:${parseInt(
              // TODO: Fix this logic for the last pick.
              (nextPick.pickStartTime!.getTime() / 1000).toFixed(0),
            )}:R>. On deck is <@${nextPicks[1].team.user?.discordId}>`,
          });
        }
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
