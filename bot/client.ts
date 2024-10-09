import { Command } from './types/Command';
import type { ClientOptions } from 'discord.js';
import { Client, Collection } from 'discord.js';
import { readdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

class FlexSpotClient extends Client {
  public commands: Collection<string, Command>;

  // Hold the single instance of the class
  private static instance: FlexSpotClient | null = null;

  // Private constructor to prevent direct instantiation
  private constructor(options: ClientOptions) {
    super(options);
    this.commands = new Collection();
  }

  // Static method to access the single instance of MyClient
  public static getClient(options: ClientOptions): FlexSpotClient {
    if (this.instance === null) {
      this.instance = new FlexSpotClient(options);
    }
    return this.instance;
  }
}

export const getCommandsFromLocal = async (): Promise<
  Collection<string, Command>
> => {
  const commands = new Collection<string, Command>();

  const __dirname = fileURLToPath(dirname(import.meta.url));
  // TODO: Fix this hardcoding at some point
  const commandsDir =
    resolve(__dirname, 'commands') === '/myapp/build/server/commands'
      ? '/myapp/build/bot/commands'
      : resolve(__dirname, 'commands');

  const fileEndingRegex = /(ts|js|cjs)$/;

  const files = (await readdir(commandsDir)).filter(file =>
    fileEndingRegex.test(file),
  );
  for (const file of files) {
    const filePath = `./commands/${file}`;
    // TODO: Get rid of this vite-ignore exception
    const module = await import(/* @vite-ignore */ filePath);
    if (Command.guard(module)) {
      commands.set(module.data.name, module);
    }
  }

  return commands;
};

// Export the singleton instance
export default FlexSpotClient;
