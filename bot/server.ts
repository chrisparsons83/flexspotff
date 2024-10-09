import FlexSpotClient, { getCommandsFromLocal } from './client.js';
import { Events, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { envSchema } from '~/utils/helpers';

const env = envSchema.parse(process.env);

const client = FlexSpotClient.getClient({
  intents: [GatewayIntentBits.Guilds],
});

(async () => {
  client.commands = await getCommandsFromLocal();
})();

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    }
  }
});

client.once(Events.ClientReady, readyClient => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Log in to Discord with your client's token
client.login(env.DISCORD_BOT_TOKEN);
