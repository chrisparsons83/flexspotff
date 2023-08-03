import type { Cup } from "@prisma/client";

import { prisma } from "~/db.server";

export type { Cup } from "@prisma/client";

export type CupCreate = Omit<Cup, "id" | "createdAt" | "updatedAt">;
export type ScoreArray = {
  teamId: string;
  mapping: string;
  pointsScored: number;
};

export async function createCup(data: CupCreate) {
  return prisma.cup.create({
    data,
  });
}

export async function getCup(id: Cup["id"]) {
  return prisma.cup.findUnique({
    where: {
      id,
    },
  });
}

export async function getCupByYear(year: Cup["year"]) {
  return prisma.cup.findFirst({
    where: {
      year,
    },
  });
}

export async function getCups() {
  return prisma.cup.findMany({});
}
