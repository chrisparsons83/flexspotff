import FlexSpotClient, { getCommandsFromLocal } from './client.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import { Events, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { prisma } from '~/db.server';
import { envSchema } from '~/utils/helpers';

const env = envSchema.parse(process.env);

const client = FlexSpotClient.getClient({
  intents: [GatewayIntentBits.Guilds],
});

/**
 * Tells the user their command failed, without letting that failure kill the bot.
 *
 * The recovery reply can fail too, and routinely does: if the command blew up
 * because the interaction had already expired (10062), replying to it expires as
 * well. That rejection used to escape an async event listener, which Node turns
 * into an `error` event on the client - and with no listener for it, the whole
 * process died. One unlucky command took the bot down with it.
 */
async function reportCommandError(interaction: ChatInputCommandInteraction) {
  const content = 'There was an error while executing this command!';

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  } catch (error) {
    console.error('Could not report the command error to Discord:', error);
  }
}

// Without a listener, discord.js emitting `error` is an unhandled `error` event,
// which Node treats as fatal.
client.on(Events.Error, error => {
  console.error('Discord client error:', error);
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`,
      );
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await reportCommandError(interaction);
    }
  } else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`,
      );
      return;
    }

    if (!command.autocomplete) {
      console.error(
        `No autocomplete function found for ${interaction.commandName}`,
      );
      return;
    }

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
  }
});

client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

/**
 * Commands are loaded before logging in, not alongside it.
 *
 * Each command is a CJS bundle, so importing it is a blocking require. Logging in
 * first meant the gateway was live while the event loop was still jammed loading
 * them, and an interaction arriving in that window sat queued past the three
 * seconds Discord allows for an acknowledgement - so the command's very first
 * `deferReply` came back 404 Unknown interaction.
 */
async function main() {
  client.commands = await getCommandsFromLocal();
  console.log(`Loaded ${client.commands.size} commands`);

  // Loading the commands opened a Prisma client, but the connection is only
  // really paid for on the first query. Doing that here keeps it out of the
  // three seconds a command has to acknowledge - the first invocation after a
  // deploy was otherwise the one that paid it.
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    // Worth starting anyway: a command that needs the database will report its
    // own failure, and the bot staying down helps nobody.
    console.error('Could not warm the database connection:', error);
  }

  await client.login(env.DISCORD_BOT_TOKEN);
}

main().catch(error => {
  console.error('Failed to start the bot:', error);
  process.exit(1);
});
