import type { CupTeam, League, Team, User } from '@prisma/client';
import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getCupByYear } from '~/models/cup.server';
import { getCupGamesByCup } from '~/models/cupgame.server';
import { getCupWeeks } from '~/models/cupweek.server';
import { getCurrentSeason } from '~/models/season.server';
import { getCurrentWeek } from '~/models/seasonWeek.server';
import type { TeamGame } from '~/models/teamgame.server';
import { getTeamGameMultiweekTotalsSeparated } from '~/models/teamgame.server';
import { getUserByDiscordId } from '~/models/user.server';
import { roundNameMapping } from '~/utils/constants';
import type { ArrElement } from '~/utils/types';

const TEAM_NAME_DISPLAY_MAX_LENGTH = 20;

export const data = new SlashCommandBuilder()
  .setName('cup')
  .setDescription('Get current match score in your cup match')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription(
        'Optional: the user to check. If this is left blank, your user will be checked.',
      ),
  );

export const execute = async (interaction: ChatInputCommandInteraction) => {
  await interaction.deferReply();
  const userId = interaction.options.getUser('user')?.id || interaction.user.id;

  const flexspotUser = await getUserByDiscordId(userId);
  if (!flexspotUser) {
    return interaction.editReply('This user does not exist in the system');
  }

  // Get the current active week to display
  const season = await getCurrentSeason();
  if (!season) {
    return interaction.editReply('There is no current active season');
  }
  const seasonWeek = await getCurrentWeek();
  if (!seasonWeek) {
    return interaction.editReply('There is no current active week');
  }

  // Get the correct game to display, which may be no game, they may be eliminated
  const cup = await getCupByYear(season.year);
  if (!cup) {
    return interaction.editReply('No cup has been created');
  }

  // Get a bunch of cup data to use later.
  const cupWeeks = await getCupWeeks(cup.id);
  const cupGames = await getCupGamesByCup(cup.id);
  const currentRound = cupWeeks.find(
    cupWeek => cupWeek.week === seasonWeek.weekNumber,
  );

  // If we don't have a current round, then we don't have a cup going on, otherwise if it's seeding,
  // we should indicate that. We probably need to do something at the end of the season for this
  // logic but for now, this should work.
  if (!currentRound) {
    return interaction.editReply('Cup is not currently in progress');
  }
  if (currentRound.mapping === 'SEEDING') {
    return interaction.editReply('Cup is in the seeding round');
  }

  // Get the games for the user being asked about.
  const userCupGames = cupGames.filter(
    cupGame =>
      cupGame.topTeam?.team.user?.discordId === userId ||
      cupGame.bottomTeam?.team.user?.discordId === userId,
  );
  if (userCupGames.length === 0) {
    return interaction.editReply('Player did not participate in cup');
  }

  // Figure out if they have a current match for the week, if so, show that, otherwise show the last
  // game they have, which is going to be the round they were eliminated in
  const matchToDisplay =
    userCupGames.find(
      userCupGame => userCupGame.round === currentRound?.mapping,
    ) || userCupGames[userCupGames.length - 1];

  // If there's not a bottom team or a top team, then they're on bye and we should display this.
  // This probably should be adjusted to show the matchup vs bye but we don't need to worry about
  // that until next season.
  if (!matchToDisplay.bottomTeam) {
    return interaction.editReply('Player is on bye this week');
  }
  if (!matchToDisplay.topTeam) {
    return interaction.editReply('Player is on bye this week');
  }

  // This gets the cup team object for the user in question - we use this for additional data
  const userCupTeamObject =
    matchToDisplay.topTeam?.team.user?.discordId === userId
      ? matchToDisplay.topTeam
      : matchToDisplay.bottomTeam;

  // This gets the weeks we need to use to calculate the match score.
  const weeksToScore = cupWeeks
    .filter(cupWeek => cupWeek.mapping === matchToDisplay.round)
    .map(cupWeek => cupWeek.week);

  // Get all the scores for the teams we care about.
  const rawScores = (
    await getTeamGameMultiweekTotalsSeparated(weeksToScore, season.year)
  ).filter(
    score =>
      score.teamId === matchToDisplay.topTeam?.teamId ||
      score.teamId === matchToDisplay.bottomTeam?.teamId,
  );

  // Make a map out of the scores for team ID and total points, this mainly covers the two-week
  // matchups.
  const mappedScores = rawScores.reduce((acc, cur) => {
    acc.set(cur.teamId, (acc.get(cur.teamId) || 0) + cur.pointsScored);
    return acc;
  }, new Map<Team['id'], TeamGame['pointsScored']>());

  // Get some booleans
  const hasLostMatch = matchToDisplay.losingTeamId === userCupTeamObject.id;
  const hasWonMatch = matchToDisplay.winningTeamId === userCupTeamObject.id;

  // This show the title on the embed.
  const title = `${hasLostMatch ? 'Lost ' : hasWonMatch ? 'Won ' : ''}${
    roundNameMapping.find(roundName => roundName.key === matchToDisplay.round)
      ?.label || ''
  }`;

  const embed = new EmbedBuilder()
    .setTitle(flexspotUser.discordName)
    .setColor(hasLostMatch ? 0xcc0000 : hasWonMatch ? 0xcc0000 : null)
    .setDescription(
      `**${title}**\n${formatGame(mappedScores, matchToDisplay)}`,
    );

  await interaction.editReply({ embeds: [embed] });
};

const formatGame = (
  scores: Map<Team['id'], TeamGame['pointsScored']>,
  teams: ArrElement<Awaited<ReturnType<typeof getCupGamesByCup>>>,
) => {
  if (!teams.bottomTeam || !teams.topTeam) return '';

  // Get lengths of each of the three columns
  const columnSeedLength = Math.max(
    teams.bottomTeam.seed.toString().length,
    teams.topTeam.seed.toString().length,
  );
  const columnTeamNameLength = TEAM_NAME_DISPLAY_MAX_LENGTH;
  const columnScoreLength = Math.max(
    ...[...scores.values()].map(value => value.toFixed(2).length),
  );

  const results = [
    teamDisplayString(
      teams.topTeam,
      scores,
      columnSeedLength,
      columnTeamNameLength,
      columnScoreLength,
    ),
    teamDisplayString(
      teams.bottomTeam,
      scores,
      columnSeedLength,
      columnTeamNameLength,
      columnScoreLength,
    ),
  ];

  return results.join('\n');
};

const teamDisplayString = (
  team: CupTeam & {
    team: Team & {
      user: User | null;
      league: League;
    };
  },
  scores: Map<Team['id'], TeamGame['pointsScored']>,
  seedLength: number,
  teamNameLength: number,
  scoreLength: number,
): string => {
  const seedDisplay = team.seed.toString().padStart(seedLength);
  const teamDisplay = (
    (team.team.user?.discordName || 'Unknown User').length <=
    TEAM_NAME_DISPLAY_MAX_LENGTH
      ? team.team.user?.discordName || 'Unknown User'
      : // We can force here because we know that if we got to this ternary the user name has to exist
        // even though Typescript can't logic that out
        team.team.user!.discordName.substring(
          0,
          TEAM_NAME_DISPLAY_MAX_LENGTH - 1,
        ) + '…'
  ).padEnd(teamNameLength);
  const scoreDisplay = scores
    .get(team.team.id)
    ?.toFixed(2)
    .padStart(scoreLength);

  const teamLink = `https://sleeper.com/roster/${team.team.league.sleeperLeagueId}/${team.team.rosterId}`;

  return `[\`[${seedDisplay}] ${teamDisplay} ${scoreDisplay}\`](${teamLink})`;
};
