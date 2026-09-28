# Member names and avatars

The site shows every member the way the Discord server shows them.

- **Name:** server nickname, else Discord display name, else @username.
- **Avatar:** server avatar, else account avatar, else Discord's default.

`User.discordName` and `User.discordAvatar` hold the result. The raw pieces
(`discordNick`, `discordGlobalName`, `discordUsername`, `discordGuildAvatar`,
`discordUserAvatar`) are stored alongside so the choice can be remade.
`app/utils/discord.ts` has the rules; `applyDiscordProfile` in
`app/models/user.server.ts` is the only thing that writes them.

## What keeps them current

1. **Login** reads the member's server profile.
2. **The bot** (`bot/server.ts`) applies nickname, avatar and role changes as
   they happen. This needs the Server Members privileged intent turned on in
   the Discord developer portal.
3. **`sync-member-profiles`** (hourly, in the scheduler) re-reads the whole
   member list, to catch anything missed while the bot was down.

Members who leave the server keep the last name and avatar the site saw, and
their roles, and are marked `inGuild = false`. Placeholder members from old
sheets (`legacy:` IDs) and merged-away accounts are never synced.

The signed-in member is reloaded from the database on every request, so changes
show up without logging out. Only the member ID is read from the session cookie.

## Nickname churn

Nicknames change often, so:

- `<MemberName>` shows the @username on hover.
- Profiles show the @username and up to five past names ("Also known as").
- Member pickers match on @username and past names as well as the current name.

Past names come from `UserNameHistory`, which gets a row whenever a member's
display name changes.
