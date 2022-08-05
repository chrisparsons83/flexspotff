import type { Episode } from "@prisma/client";
import { prisma } from "~/db.server";

export type { Episode } from "@prisma/client";

export type EpisodeCreate = Omit<Episode, "id" | "createdAt" | "updatedAt">;

export async function createEpisode(episode: EpisodeCreate) {
  return prisma.episode.create({ data: episode });
}
