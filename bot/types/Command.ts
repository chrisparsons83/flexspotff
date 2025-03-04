import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import { z } from 'zod';

export interface Command {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export const Command = {
  guard: (command: Command): command is Command => {
    return Object.hasOwn(command, 'data') && Object.hasOwn(command, 'execute');
  },
};

export const applicationCommand = z.object({
  id: z.string(),
  application_id: z.string(),
  version: z.string(),
  type: z.number().optional(),
  name: z.string(),
  description: z.string(),
  guild_id: z.string().optional(),
  nsfw: z.boolean().optional(),
});
export const applicationCommands = applicationCommand.array();
