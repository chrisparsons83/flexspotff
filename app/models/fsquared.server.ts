import type { FSquaredEntry } from "@prisma/client";
import { prisma } from "~/db.server";
export type { FSquaredEntry } from "@prisma/client";

type FSquaredEntryCreateInput = Omit<
  FSquaredEntry,
  "id" | "createdAt" | "updatedAt"
>;

export async function createEntry(entry: FSquaredEntryCreateInput) {
  return prisma.fSquaredEntry.create({
    data: entry,
  });
}

export async function getEntry(id: FSquaredEntry["id"]) {
  return prisma.fSquaredEntry.findUnique({
    where: {
      id,
    },
  });
}

export async function getEntryByUserAndYear(
  userId: FSquaredEntry["userId"],
  year: FSquaredEntry["year"]
) {
  return prisma.fSquaredEntry.findFirst({
    where: {
      userId,
      year,
    },
  });
}
