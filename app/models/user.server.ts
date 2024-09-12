import type { User } from '@prisma/client';

import { prisma } from '~/db.server';

export type { User } from '@prisma/client';

export async function getUserById(id: User['id']) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByDiscordId(discordId: User['discordId']) {
  return prisma.user.findUnique({ where: { discordId } });
}

export async function createUser(
  discordId: User['discordId'],
  discordName: User['discordName'],
  discordAvatar: User['discordAvatar'],
) {
  return prisma.user.create({
    data: {
      discordId,
      discordName,
      discordAvatar,
    },
  });
}

export async function deleteUserByDiscordId(discordId: User['discordId']) {
  return prisma.user.delete({ where: { discordId } });
}

export async function getUser(id: User['id']) {
  return prisma.user.findUnique({
    where: {
      id,
    },
  });
}

export async function getUsersByIds(ids: User['id'][]) {
  return prisma.user.findMany({
    where: {
      id: { in: ids },
    },
  });
}

export async function getUsers() {
  return prisma.user.findMany({
    orderBy: {
      discordName: 'asc',
    },
    include: {
      sleeperUsers: true,
    },
  });
}

export async function updateUser(user: Partial<User>) {
  return prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      discordName: user.discordName || undefined,
      discordAvatar: user.discordAvatar || undefined,
      discordRoles: user.discordRoles || undefined,
    },
  });
}
