import type { Player } from '@prisma/client';
import { prisma } from '~/db.server';

export type { Player } from '@prisma/client';

export type PlayerCreate = Omit<Player, 'id'>;

export async function getPlayer(id: Player['id']) {
  return prisma.player.findUnique({
    where: {
      id,
    },
  });
}

export async function getPlayers() {
  return prisma.player.findMany({});
}

export async function getActivePlayersByPosition(position: Player['position']) {
  return prisma.player.findMany({
    where: {
      position,
      NOT: [
        {
          nflTeam: null,
        },
      ],
    },
    orderBy: [
      {
        lastName: 'asc',
      },
      { firstName: 'asc' },
    ],
  });
}

export async function getPlayersByIDs(ids: Player['id'][]) {
  return prisma.player.findMany({
    where: {
      id: {
        in: ids,
      },
    },
  });
}

export async function upsertPlayer(player: PlayerCreate) {
  return prisma.player.upsert({
    where: {
      sleeperId: player.sleeperId,
    },
    update: {
      ...player,
    },
    create: {
      ...player,
    },
  });
}
