import { z } from 'zod';

const envSchema = z.object({
  AWS_BUCKET: z.string().min(1),
  AWS_REGION: z.string().min(1),
  AWS_ENDPOINT: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  API_KEY: z.string().min(1),
  BREE_RUN: z.enum(['off', 'on']),
  DATABASE_URL: z.string().min(1),
  DEV_GUILD_ID: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_SECRET: z.string().min(1),
  FORCE_ADMIN: z.enum(['off', 'on']),
  SESSION_SECRET: z.string().min(1),
  WEBSITE_URL: z.string().min(1),
  SPREADS_API_KEY: z.string().min(1),
  PLAYWRIGHT_DISCORD_USERNAME: z.optional(z.string().min(1)),
  PLAYWRIGHT_DISCORD_PASSWORD: z.optional(z.string().min(1)),
});

const shuffleArray = <T>(array: T[]): T[] => {
  const arrayCopy = [...array];
  for (let i = arrayCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
  }
  return arrayCopy;
};

export { envSchema, shuffleArray };
