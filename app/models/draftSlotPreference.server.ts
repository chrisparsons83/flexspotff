import type { DraftSlotPreference } from '@prisma/client';
import { prisma } from '~/db.server';

export type { DraftSlotPreference } from '@prisma/client';

export type DraftSlotPreferenceWithDraftSlot = DraftSlotPreference & {
  draftSlot: {
    id: string;
    draftDateTime: Date;
  };
};

export async function getUserDraftSlotPreferences(
  userId: string,
  seasonId: string,
): Promise<DraftSlotPreferenceWithDraftSlot[]> {
  return prisma.draftSlotPreference.findMany({
    where: {
      userId,
      seasonId,
    },
    include: {
      draftSlot: {
        select: {
          id: true,
          draftDateTime: true,
        },
      },
    },
    orderBy: {
      draftSlot: {
        draftDateTime: 'asc',
      },
    },
  });
}

export async function upsertUserDraftSlotPreferences(
  userId: string,
  seasonId: string,
  draftSlotIds: string[],
): Promise<void> {
  // Delete existing preferences for this user and season
  await prisma.draftSlotPreference.deleteMany({
    where: {
      userId,
      seasonId,
    },
  });

  // Create new preferences
  if (draftSlotIds.length > 0) {
    await prisma.draftSlotPreference.createMany({
      data: draftSlotIds.map(draftSlotId => ({
        userId,
        draftSlotId,
        seasonId,
      })),
    });
  }
}

export async function getDraftSlotsWithUserPreferences(
  userId: string,
  seasonId: string,
) {
  const draftSlots = await prisma.draftSlot.findMany({
    where: {
      seasonId,
    },
    include: {
      preferences: {
        where: {
          userId,
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      draftDateTime: 'asc',
    },
  });

  return draftSlots.map(slot => ({
    ...slot,
    isSelected: slot.preferences.length > 0,
  }));
}
