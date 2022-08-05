declare global {
  namespace NodeJS {
    interface ProcessEnv {
      AWS_BUCKET: string;
      AWS_REGION: string;
      AWS_ENDPOINT: string;
      AWS_ACCESS_KEY_ID: string;
      AWS_SECRET_ACCESS_KEY: string;
      DATABASE_URL: string;
      DISCORD_CLIENT_ID: string;
      DISCORD_SECRET: string;
      SESSION_SECRET: string;
      WEBSITE_URL: string;
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {};
