# Flex Spot FF Website Code

This stack is built upon [Remix](https://remix.run/), so if you have questions,
the [Remix documentation](https://remix.run/docs/en/main) is your best bet.

## Development

### Initial Setup

- Install your NPM modules

  ```sh
  npm install
  ```

- Start the Postgres Database in [Docker](https://www.docker.com/get-started):

  ```sh
  npm run docker
  ```

  > **Note:** The npm script will complete while Docker sets up the container in
  > the background. Ensure that Docker has finished and your container is
  > running before proceeding.

- Copy .env.example to .env, and update the following:

  - DATABASE_URL to remove the \_test at the end, as that's used for the testing
    pipeline
  - DISCORD_CLIENT_ID: Go to discord.com/developers, create an application, and
    then under the OAuth2 tab in settings, use the client ID
  - DISCORD_SECRET: On the same page as above, use the client secret (you may
    need to reset yours)
  - SESSION_SECRET: Not required but does set a different string for encrypting

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

- Run the first build:

  ```sh
  npm run build
  ```

- Start dev server:

  ```sh
  npm run dev
  ```

This starts your app in development mode, rebuilding assets on file changes.

If you'd prefer not to use Docker, you can also use Fly's Wireguard VPN to
connect to a development database (or even your production database). You can
find the instructions to set up Wireguard
[here](https://fly.io/docs/reference/private-networking/#install-your-wireguard-app),
and the instructions for creating a development database
[here](https://fly.io/docs/reference/postgres/).

## Database syncing

Assuming you have a backup database to load and are using docker, you can use
the db-sync npm script to handle this.

```sh
npm run db-sync -- NAME_OF_BACKUP_FILE
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
