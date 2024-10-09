import { getCommandsFromLocal } from './client';
import { applicationCommands } from './types/Command';
import { REST, Routes } from 'discord.js';
import { envSchema } from '~/utils/helpers';

const env = envSchema.parse(process.env);

export interface DeleteCommandsProps {
  guildId?: string;
  commandId: string;
}
export const deleteCommand = async ({
  guildId,
  commandId,
}: DeleteCommandsProps) => {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);

  try {
    if (guildId) {
      await rest.delete(
        `${Routes.applicationGuildCommands(
          env.DISCORD_CLIENT_ID,
          guildId,
        )}/${commandId}`,
      );
    } else {
      await rest.delete(
        `${Routes.applicationCommands(env.DISCORD_CLIENT_ID)}/${commandId}`,
      );
    }
  } catch (error) {
    console.error(error);
  }
};

interface DeployCommandsProps {
  guildId: string;
}
export const deployCommands = async (props: DeployCommandsProps | null) => {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);

  const localCommands = await getCommandsFromLocal();

  try {
    if (props) {
      await rest.put(
        Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, props.guildId),
        {
          body: [...localCommands.values()].map(command => command.data),
        },
      );
    } else {
      await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
        body: [...localCommands.values()].map(command => command.data),
      });
    }

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
};

interface GetCommandsProps {
  guildId: string;
}
export const getCommands = async (props: GetCommandsProps | null) => {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_BOT_TOKEN);

  try {
    const commands = props
      ? applicationCommands.parse(
          await rest.get(
            Routes.applicationGuildCommands(
              env.DISCORD_CLIENT_ID,
              props.guildId,
            ),
          ),
        )
      : applicationCommands.parse(
          await rest.get(Routes.applicationCommands(env.DISCORD_CLIENT_ID)),
        );

    return commands;
  } catch (error) {
    console.error(error);
  }
};
