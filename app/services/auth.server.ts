import type { Session } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Authenticator } from 'remix-auth';
import { DiscordStrategy, SocialsProvider } from 'remix-auth-socials';
import { prisma } from '~/db.server';
import type { DiscordProfile, User } from '~/models/user.server';
import { resolveMemberForLogin } from '~/models/user.server';
import { sessionStorage } from '~/services/session.server';
import {
  SERVER_DISCORD_ADMIN_ROLE_ID,
  SERVER_DISCORD_ID,
  SERVER_DISCORD_PODCAST_ADMIN_ROLE_ID,
} from '~/utils/constants';

type RedirectOptions = {
  successRedirect?: string;
  failureRedirect?: string;
  headers?: HeadersInit;
};

/**
 * The member a session belongs to, as they are now rather than as they were
 * when they logged in.
 *
 * The session cookie holds a copy of the User row taken at login and kept for
 * 30 days. Reading that copy meant a nickname or avatar change - or a role
 * granted or taken away - did not reach the site until the member logged out and
 * back in. Only the ID is trusted from the cookie now.
 */
export async function loadSessionMember(sessionUser: Pick<User, 'id'>) {
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });

  // Merged away since they logged in: they are the member they were merged
  // into now, exactly as their next login would resolve.
  if (user?.mergedIntoId) {
    return prisma.user.findUnique({ where: { id: user.mergedIntoId } });
  }

  return user;
}

class MemberAuthenticator extends Authenticator<User> {
  isAuthenticated(
    request: Request | Session,
    options?: {
      successRedirect?: never;
      failureRedirect?: never;
      headers?: never;
    },
  ): Promise<User | null>;
  isAuthenticated(
    request: Request | Session,
    options: {
      successRedirect: string;
      failureRedirect?: never;
      headers?: HeadersInit;
    },
  ): Promise<null>;
  isAuthenticated(
    request: Request | Session,
    options: {
      successRedirect?: never;
      failureRedirect: string;
      headers?: HeadersInit;
    },
  ): Promise<User>;
  isAuthenticated(
    request: Request | Session,
    options: {
      successRedirect: string;
      failureRedirect: string;
      headers?: HeadersInit;
    },
  ): Promise<null>;
  async isAuthenticated(
    request: Request | Session,
    options: RedirectOptions = {},
  ): Promise<User | null> {
    const sessionUser = await super.isAuthenticated(request);
    // A member deleted since they logged in is treated as logged out.
    const user = sessionUser ? await loadSessionMember(sessionUser) : null;

    if (user) {
      if (options.successRedirect) {
        throw redirect(options.successRedirect, { headers: options.headers });
      }
      return user;
    }

    if (options.failureRedirect) {
      throw redirect(options.failureRedirect, { headers: options.headers });
    }
    return null;
  }
}

export let authenticator = new MemberAuthenticator(sessionStorage, {
  sessionKey: '_session',
});

/**
 * The Discord profile of the account that just logged in, as the server sees
 * it. The member lookup fails (404) for someone who is not in the server.
 */
export function profileFromLogin(
  account: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar: string | null;
  },
  member: {
    ok: boolean;
    json: { nick?: string | null; avatar?: string | null; roles?: string[] };
  },
): DiscordProfile {
  const base = {
    discordId: account.id,
    username: account.username,
    globalName: account.global_name ?? null,
    userAvatar: account.avatar,
  };

  if (!member.ok || !Array.isArray(member.json.roles)) {
    return { ...base, inGuild: false };
  }

  return {
    ...base,
    inGuild: true,
    nick: member.json.nick ?? null,
    guildAvatar: member.json.avatar ?? null,
    roles: member.json.roles,
  };
}

authenticator.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_SECRET,
      callbackURL: `${process.env.WEBSITE_URL}/auth/${SocialsProvider.DISCORD}/callback`,
      scope: ['identify', 'guilds.members.read'],
    },
    async props => {
      const resGuildMember = await fetch(
        `https://discord.com/api/users/@me/guilds/${SERVER_DISCORD_ID}/member`,
        {
          headers: {
            Authorization: `${props.extraParams.token_type} ${props.accessToken}`,
          },
        },
      );
      const jsonGuild = await resGuildMember.json();

      // The strategy maps displayName to the @username, not the display name
      // Discord shows, so read the raw account instead. Its typings predate
      // global_name.
      const account = props.profile.__json as typeof props.profile.__json & {
        global_name?: string | null;
      };

      return resolveMemberForLogin(
        profileFromLogin(account, { ok: resGuildMember.ok, json: jsonGuild }),
      );
    },
  ),
);

export const isAdmin = (user: User) => {
  if (process.env.FORCE_ADMIN === 'on') {
    return true;
  }

  if (!user.discordRoles || user.discordRoles.length === 0) {
    return false;
  }
  return user.discordRoles.includes(SERVER_DISCORD_ADMIN_ROLE_ID);
};

export const requireAdmin = (user: User) => {
  if (process.env.FORCE_ADMIN === 'on') {
    return true;
  }

  if (!isAdmin(user)) {
    throw new Error('You do not have access to this page.');
  }

  return true;
};

export const isPodcastEditor = (user: User) => {
  if (!user.discordRoles || user.discordRoles.length === 0) {
    return false;
  }

  if (isAdmin(user)) {
    return true;
  }

  return user.discordRoles.includes(SERVER_DISCORD_PODCAST_ADMIN_ROLE_ID);
};

export const requirePodcastEditor = (user: User) => {
  if (!isPodcastEditor(user)) {
    throw new Error('You do not have access to this page.');
  }

  return true;
};

export const isEditor = (user: User) => {
  return isAdmin(user) || isPodcastEditor(user);
};

export const requireEditor = (user: User) => {
  if (!isEditor(user)) {
    throw new Error('You do not have access to this page.');
  }

  return true;
};
