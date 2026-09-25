import type { User } from '@prisma/client';
import { prisma } from '~/db.server';
import { normalizeName } from '~/utils/names';

export type { MemberAlias } from '@prisma/client';

/**
 * The members that sheet names have already been matched to, keyed by the
 * normalized name. Names that normalize away to nothing are never stored, so
 * they are dropped here too.
 */
export async function getMemberAliases(names: string[]) {
  const aliases = [...new Set(names.map(normalizeName))].filter(Boolean);

  const rows = await prisma.memberAlias.findMany({
    where: { alias: { in: aliases } },
    include: {
      user: { select: { id: true, discordName: true, mergedIntoId: true } },
    },
  });

  return new Map(rows.map(row => [row.alias, row.user]));
}

export async function upsertMemberAlias(name: string, userId: User['id']) {
  const alias = normalizeName(name);
  if (!alias) {
    throw new Error(`"${name}" has no letters or digits to match on.`);
  }

  return prisma.memberAlias.upsert({
    where: { alias },
    update: { userId },
    create: { alias, userId },
  });
}

export async function deleteMemberAlias(name: string) {
  return prisma.memberAlias.deleteMany({
    where: { alias: normalizeName(name) },
  });
}

/**
 * Creates a placeholder member for someone from an old sheet who has never
 * joined the site, and matches the name to them. The Discord ID is made up and
 * can never log in; if the person turns up later, merge the stub into their
 * real account from /admin/members/merge and their history follows them.
 */
export async function createStubMemberForAlias(name: string) {
  const alias = normalizeName(name);
  if (!alias) {
    throw new Error(`"${name}" has no letters or digits to match on.`);
  }

  // Unmatching a stub and creating it again should find the same stub rather
  // than trip over its Discord ID.
  const discordId = `legacy:${alias}`;
  const user = await prisma.user.upsert({
    where: { discordId },
    update: {},
    create: { discordId, discordName: name.trim(), discordAvatar: '' },
  });

  // A stub that was since merged into a real account is that account now.
  const memberId = user.mergedIntoId ?? user.id;
  await upsertMemberAlias(name, memberId);
  return memberId;
}
