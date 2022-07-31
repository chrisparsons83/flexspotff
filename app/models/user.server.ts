import type { User } from "@prisma/client";

import { prisma } from "~/db.server";

export type { User } from "@prisma/client";

export async function getUserById(id: User["id"]) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByDiscordId(discordId: User["discordId"]) {
  return prisma.user.findUnique({ where: { discordId } });
}

export async function createUser(
  discordId: User["discordId"],
  discordName: User["discordName"],
  discordAvatar: User["discordAvatar"]
) {
  return prisma.user.create({
    data: {
      discordId,
      discordName,
      discordAvatar,
    },
  });
}

export async function deleteUserByDiscordId(discordId: User["discordId"]) {
  return prisma.user.delete({ where: { discordId } });
}
