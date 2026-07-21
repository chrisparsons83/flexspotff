import type { DraftSlot } from '@prisma/client';
import { prisma } from '~/db.server';

export type { DraftSlot } from '@prisma/client';

export function getDraftSlots() {
  return prisma.draftSlot.findMany({
    include: {
      season: {
        select: {
          year: true,
        },
      },
    },
    orderBy: [{ season: { year: 'desc' } }, { draftDateTime: 'asc' }],
  });
}

export async function getDraftSlotsWithPreferenceCounts() {
  const draftSlots = await prisma.draftSlot.findMany({
    include: {
      season: {
        select: {
          year: true,
        },
      },
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
    orderBy: [{ season: { year: 'desc' } }, { draftDateTime: 'asc' }],
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
  seasonId,
}: Pick<DraftSlot, 'draftDateTime' | 'seasonId'>) {
  return prisma.draftSlot.create({
    data: {
      draftDateTime,
      seasonId,
    },
  });
}

export function updateDraftSlot({
  id,
  draftDateTime,
  seasonId,
}: Pick<DraftSlot, 'id' | 'draftDateTime' | 'seasonId'>) {
  return prisma.draftSlot.update({
    where: { id },
    data: {
      draftDateTime,
      seasonId,
    },
  });
}

export function deleteDraftSlot({ id }: Pick<DraftSlot, 'id'>) {
  return prisma.draftSlot.delete({
    where: { id },
  });
}

export function getDraftSlotsBySeason({ seasonId }: { seasonId: string }) {
  return prisma.draftSlot.findMany({
    where: { seasonId },
    orderBy: { draftDateTime: 'asc' },
  });
}
