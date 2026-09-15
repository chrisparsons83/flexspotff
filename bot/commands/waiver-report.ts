import type {
  ChatInputCommandInteraction,
  GuildMemberRoleManager,
} from 'discord.js';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { postWaiverReports } from '~/libs/waiver-report.server';
import { getCurrentSeason } from '~/models/season.server';
import {
  FIRST_YEAR,
  Leagues,
  SERVER_DISCORD_ADMIN_ROLE_ID,
} from '~/utils/constants';
import { envSchema } from '~/utils/helpers';

const env = envSchema.parse(process.env);

const WEEK_FIELD = 'week';
const YEAR_FIELD = 'year';
const LEAGUE_FIELD = 'league';
const PREVIEW_FIELD = 'preview';

const ALL_LEAGUES = 'all';

export const data = new SlashCommandBuilder()
  .setName('waiver-report')
  .setDescription("Re-run a week's waiver report. Admins only.")
  // Hides the command for members without Manage Server. This is a UI hint
  // only - Discord lets a server owner override it - so execute() still checks
  // the admin role itself.
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addIntegerOption(option =>
    option
      .setName(WEEK_FIELD)
      .setDescription('The week to report on.')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(18),
  )
  .addIntegerOption(option =>
    option
      .setName(YEAR_FIELD)
      .setDescription('The season to report on. Defaults to the current one.')
      // No upper bound: the builder is serialized when commands are registered
      // from /admin/bot, so a max pinned to the current year would quietly go
      // stale in January.
      .setMinValue(FIRST_YEAR),
  )
  .addStringOption(option =>
    option
      .setName(LEAGUE_FIELD)
      .setDescription('Limit to one league. Defaults to all of them.')
      .addChoices([
        { name: 'All', value: ALL_LEAGUES },
        ...Object.values(Leagues).map(league => ({
          name: league.charAt(0).toUpperCase() + league.slice(1),
          value: league,
        })),
      ]),
  )
  .addBooleanOption(option =>
    option
      .setName(PREVIEW_FIELD)
      .setDescription(
        'Show the report to just you without posting it to the channel.',
      ),
  );

/**
 * The website checks admin against User.discordRoles, but that is only refreshed
 * at login and goes stale. The interaction carries the member's live roles, so
 * use those.
 */
const isAdminInteraction = (interaction: ChatInputCommandInteraction) => {
  const roles = interaction.member?.roles;
  if (!roles) return false;

  // Gateway interactions give a role manager; raw API ones give an ID array.
  if (Array.isArray(roles)) {
    return roles.includes(SERVER_DISCORD_ADMIN_ROLE_ID);
  }
  return (roles as GuildMemberRoleManager).cache.has(
    SERVER_DISCORD_ADMIN_ROLE_ID,
  );
};

export const execute = async (interaction: ChatInputCommandInteraction) => {
  const preview = interaction.options.getBoolean(PREVIEW_FIELD) ?? false;

  await interaction.deferReply({ ephemeral: true });

  if (!isAdminInteraction(interaction)) {
    return interaction.editReply('You do not have access to this command.');
  }

  const week = interaction.options.getInteger(WEEK_FIELD, true);
  const league = interaction.options.getString(LEAGUE_FIELD) ?? ALL_LEAGUES;

  const requestedYear = interaction.options.getInteger(YEAR_FIELD);

  let year = requestedYear;
  if (year === null) {
    const season = await getCurrentSeason();
    if (!season) {
      return interaction.editReply(
        'There is no current season, so pass a year explicitly.',
      );
    }
    year = season.year;
  }

  if (!preview && !env.WAIVER_REPORT_CHANNEL_ID) {
    return interaction.editReply(
      'No waiver report channel is configured, so there is nowhere to post. Try `preview: true`.',
    );
  }

  const results = await postWaiverReports({
    year,
    week,
    leagueNames: league === ALL_LEAGUES ? undefined : [league],
    // An admin asking for a week again means they want it posted again.
    force: true,
    preview,
    channelId: env.WAIVER_REPORT_CHANNEL_ID,
  });

  if (results.length === 0) {
    return interaction.editReply(`No ${year} leagues matched that request.`);
  }

  if (preview) {
    const embeds = results.flatMap(result => result.embeds ?? []);
    const summary = results
      .map(result => `${result.leagueName}: ${result.transactionCount} rows`)
      .join('\n');

    if (embeds.length === 0) {
      return interaction.editReply(
        `Nothing to show for ${year} week ${week}.\n${summary}`,
      );
    }

    // Discord caps a message at 10 embeds; a multi-league preview can exceed it.
    return interaction.editReply({
      content: `Preview of week ${week} (not posted):\n${summary}`,
      embeds: embeds.slice(0, 10),
    });
  }

  const summary = results
    .map(
      result =>
        `${result.leagueName}: ${result.status}` +
        (result.message ? ` - ${result.message}` : ''),
    )
    .join('\n');

  return interaction.editReply(
    `${year} week ${week} waiver report:\n${summary}`,
  );
};
