# Flex Spot FF Website Code

This stack is built upon [Remix](https://remix.run/), so if you have questions,
the [Remix documentation](https://remix.run/docs/en/main) is your best bet.

## Development

### Initial Setup

- Install your NPM modules

  ```sh
  npm install
  ```

- Copy `.env.example` to `.env`.

There are two ways to get a working database. **Option A** (shared test DB) is
recommended for most new contributors.

#### Option A — Shared test database (recommended)

Ask Chris for the `DATABASE_URL` for the shared `flexspotff_test` database and
set it in your `.env`. You can skip the Docker and database-sync steps entirely.

Update these values in `.env`:

- `DATABASE_URL`: use the connection string provided by Chris
- `DISCORD_CLIENT_ID`: go to discord.com/developers, create an application, and
  use the client ID from the OAuth2 tab
- `DISCORD_SECRET`: client secret from the same page
- `SESSION_SECRET`: optional, sets the session encryption string

> **Important:** Leave `OMNI_CHANNEL_ID`, `OMNI_ROLE_ID`, and
> `LEAGUE_ANNOUNCEMENT_CHANNEL_ID` unset (they are commented out in
> `.env.example`). Without these, no Discord notifications will fire if you use
> admin routes while developing.

Then run migrations and start the dev server:

```sh
npm run setup
npm run dev
```

#### Option B — Local Docker database

- Start the Postgres Database in [Docker](https://www.docker.com/get-started):

  ```sh
  npm run docker
  ```

  > **Note:** The npm script will complete while Docker sets up the container in
  > the background. Ensure that Docker has finished and your container is
  > running before proceeding.

- Update `.env`:

  - `DATABASE_URL`: remove the `_test` suffix (that's used for the testing
    pipeline)
  - `DISCORD_CLIENT_ID`, `DISCORD_SECRET`: see Option A above
  - `SESSION_SECRET`: optional

- While you're in the discord developer settings, you'll also want to set
  redirects to the following if you want to test Discord authentication

```
http://localhost:5173/auth/discord/callback
```

- Initial setup:

  ```sh
  npm run setup
  ```

- Load database dump if you have one.

  ```sh
  npm run db-sync -- NAME_OF_BACKUP_FILE
  ```

  If you're in Windows, you can use the powershell version of this

  ```sh
  scripts\db-sync.ps1 -FileToUpdate "path-to-sql-file.sql"
  ```

- Run the first build:

  ```sh
  npm run build
  ```

- Start dev server:

  ```sh
  npm run dev
  ```

This starts your app in development mode, rebuilding assets on file changes.

## Database syncing

### Syncing production to the shared test database

To refresh the shared `flexspotff_test` database from production, use the button
on the `/admin/data` page ("Sync Test Database from Production"), or run this
from the server:

```sh
npm run db:sync-prod-to-test
```

### Restoring a backup to a local Docker database

Assuming you have a backup database to load and are using docker, you can use
the db-sync npm script to handle this.

```sh
npm run db-sync -- NAME_OF_BACKUP_FILE
```

If you're in Windows, you can use the powershell version of this

```sh
scripts\db-sync.ps1 -FileToUpdate "path-to-sql-file.sql"
```

## Styling

We use [TailwindCSS](https://tailwindcss.com/) to do our class level stying, and
then we are using [ShadCN UI](https://ui.shadcn.com/) as a component library.

## Debugging

The best way to do this in VSCode is to use the `Debug: debug npm script`, which
you can access from the command palette (Ctrl-Shift-P). Select `dev` from the
dropdown, which will run `npm run dev` and attach a debugger which can be
accessed from VSCode. Control-clicking the link in the terminal will open it up
in your web browser, but you can set breakpoints from within VSCode and examine
the code that way.

## Deployment

We use GitHub Actions for continuous integration and deployment. Anything that
gets into the `main` branch will be deployed to production after running
tests/build/etc..

## Testing

### End to End

This uses Playwright to do E2E testing. In order to set up playwright, you may
need to run the following command first:

```
npx playwright install --with-deps
```

Tests are stored in `/tests`, and there's a npm script `test:e2e:ui` that you
can run to visualize the testing to debug things.

### Vitest

For lower level tests of utilities and individual components, we use `vitest`.
We have DOM-specific assertion helpers via
[`@testing-library/jest-dom`](https://testing-library.com/jest-dom).

### Type Checking

This project uses TypeScript. It's recommended to get TypeScript set up for your
editor to get a really great in-editor experience with type checking and
auto-complete. To run type checking across the whole project, run
`npm run typecheck`.

### Linting

This project uses ESLint for linting. That is configured in `.eslintrc.js`.

### Formatting

We use [Prettier](https://prettier.io/) for auto-formatting in this project.
It's recommended to install an editor plugin (like the
[VSCode Prettier plugin](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode))
to get auto-formatting on save. There's also a `npm run format` script you can
run to format all files in the project.

### Bot

There's a bot in there now. You need to set up the DISCORD_BOT_TOKEN env
variable in order to have it work, which you can get from the Discord developers
center.

You can dev the bot using `npm run dev:bot`. Using `dev:all` instead will have
the website and bot run at the same time.

To make a new command, make a file with the command name under /bot/commands.
You need to export a data and execute function at the minimum. This uses
discord.js so use that as reference.
