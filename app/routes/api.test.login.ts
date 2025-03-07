import { json } from '@remix-run/node';
import type { ActionFunction } from '@remix-run/node';
import { sessionStorage } from '~/services/session.server';
import { createUser, getUserByDiscordId, updateUser } from '~/models/user.server';

export const action: ActionFunction = async ({ request }) => {
  const body = await request.json();
  
  // First ensure the user exists in the database
  let user = await getUserByDiscordId(body.discordId);
  if (!user) {
    user = await createUser(
      body.discordId,
      body.discordName,
      body.discordAvatar
    );
  }

  // Update user's roles if they've changed
  if (JSON.stringify(user.discordRoles) !== JSON.stringify(body.discordRoles)) {
    user = await updateUser({
      ...user,
      discordRoles: body.discordRoles
    });
  }

  // Create a new session with the user's actual ID
  const session = await sessionStorage.getSession();
  session.set('_session', {
    id: user.id,
    discordId: user.discordId,
    discordName: user.discordName,
    discordAvatar: user.discordAvatar,
    discordRoles: user.discordRoles
  });

  // Return response with session cookie
  return json(
    { success: true },
    {
      headers: {
        'Set-Cookie': await sessionStorage.commitSession(session)
      }
    }
  );
}; 