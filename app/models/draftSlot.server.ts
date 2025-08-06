import type { DraftSlot } from '@prisma/client';
import { prisma } from '~/db.server';

export type { DraftSlot } from '@prisma/client';

export function getDraftSlots() {
  return prisma.draftSlot.findMany({
    orderBy: [
      { season: 'desc' },
      { draftDateTime: 'asc' },
    ],
  });
}

export async function getDraftSlotsWithPreferenceCounts() {
  const draftSlots = await prisma.draftSlot.findMany({
    include: {
      preferences: {
        include: {
          user: {
            select: {
              id: true,
              discordName: true,
            },
          },
        },
      },
    },
    orderBy: [
      { season: 'desc' },
      { draftDateTime: 'asc' },
    ],
  });

  return draftSlots.map(slot => ({
    ...slot,
    availableCount: slot.preferences.length,
    availableUsers: slot.preferences.map(pref => pref.user),
  }));
}

export async function getUniqueUsersWithPreferences() {
  const uniqueUsers = await prisma.draftSlotPreference.findMany({
    select: {
      userId: true,
    },
    distinct: ['userId'],
  });
  
  return uniqueUsers.length;
}

export function getDraftSlot({ id }: Pick<DraftSlot, 'id'>) {
  return prisma.draftSlot.findFirst({
    where: { id },
  });
}

export function createDraftSlot({
  draftDateTime,
  season,
}: Pick<DraftSlot, 'draftDateTime' | 'season'>) {
  return prisma.draftSlot.create({
    data: {
      draftDateTime,
      season,
    },
  });
}

export function updateDraftSlot({
  id,
  draftDateTime,
  season,
}: Pick<DraftSlot, 'id' | 'draftDateTime' | 'season'>) {
  return prisma.draftSlot.update({
    where: { id },
    data: {
      draftDateTime,
      season,
    },
  });
}

export function deleteDraftSlot({ id }: Pick<DraftSlot, 'id'>) {
  return prisma.draftSlot.delete({
    where: { id },
  });
}

export function getDraftSlotsBySeason({ season }: { season: number }) {
  return prisma.draftSlot.findMany({
    where: { season },
    orderBy: { draftDateTime: 'asc' },
  });
}
