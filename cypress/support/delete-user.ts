// Use this to delete a user by their email
// Simply call this with:
// npx ts-node --require tsconfig-paths/register ./cypress/support/delete-user.ts username@example.com
// and that user will get deleted
import { installGlobals } from '@remix-run/node';
import { prisma } from '~/db.server';

installGlobals();

async function deleteUser(discordId: string) {
  if (!discordId) {
    throw new Error('email required for login');
  }
  if (!discordId.endsWith('@example.com')) {
    throw new Error('All test emails must end in @example.com');
  }

  await prisma.user.delete({ where: { discordId } });
}

deleteUser(process.argv[2]);
