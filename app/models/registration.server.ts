import type { Registration, User } from "@prisma/client";

import { prisma } from "~/db.server";

export type { Registration } from "@prisma/client";

export async function createRegistration(
  userId: User["id"],
  year: Registration["year"]
) {
  return prisma.registration.create({
    data: {
      year,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
}

export async function getRegistrationByUserAndYear(
  userId: User["id"],
  year: Registration["year"]
) {
  return prisma.registration.findFirst({
    where: { year, userId },
  });
}
