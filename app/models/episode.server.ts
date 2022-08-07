import type { Episode } from "@prisma/client";
import { prisma } from "~/db.server";

export type { Episode } from "@prisma/client";

export type EpisodeCreate = Omit<Episode, "id" | "createdAt" | "updatedAt">;
export type EpisodeUpdate = Omit<Episode, "createdAt" | "updatedAt">;

export async function createEpisode(episode: EpisodeCreate) {
  return prisma.episode.create({ data: episode });
}

export async function getEpisode(id: Episode["id"]) {
  return prisma.episode.findFirst({ where: { id } });
}

export async function getEpisodes() {
  return prisma.episode.findMany({
    orderBy: {
      publishDate: "desc",
    },
  });
}

export async function updateEpisode(episode: EpisodeUpdate) {
  return prisma.episode.update({
    where: {
      id: episode.id,
    },
    data: episode,
  });
}
