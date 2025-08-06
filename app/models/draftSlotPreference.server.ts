import type { DraftSlotPreference } from '@prisma/client';
import { prisma } from '~/db.server';

export type { DraftSlotPreference } from '@prisma/client';

export type DraftSlotPreferenceWithDraftSlot = DraftSlotPreference & {
  draftSlot: {
    id: string;
    draftDateTime: Date;
    season: number;
  };
};

export async function getUserDraftSlotPreferences(
  userId: string,
  season: number
): Promise<DraftSlotPreferenceWithDraftSlot[]> {
  return prisma.draftSlotPreference.findMany({
    where: {
      userId,
      season,
    },
    include: {
      draftSlot: {
        select: {
          id: true,
          draftDateTime: true,
          season: true,
        },
      },
    },
    orderBy: {
      ranking: 'asc',
    },
  });
}

export async function upsertUserDraftSlotPreferences(
  userId: string,
  season: number,
  preferences: { draftSlotId: string; ranking: number }[]
): Promise<void> {
  // Delete existing preferences for this user and season
  await prisma.draftSlotPreference.deleteMany({
    where: {
      userId,
      season,
    },
  });

  // Create new preferences
  if (preferences.length > 0) {
    await prisma.draftSlotPreference.createMany({
      data: preferences.map((pref) => ({
        userId,
        draftSlotId: pref.draftSlotId,
        season,
        ranking: pref.ranking,
      })),
    });
  }
}

export async function getDraftSlotsWithUserPreferences(
  userId: string,
  season: number
) {
  const draftSlots = await prisma.draftSlot.findMany({
    where: {
      season,
    },
    include: {
      preferences: {
        where: {
          userId,
        },
        select: {
          ranking: true,
        },
      },
    },
    orderBy: {
      draftDateTime: 'asc',
    },
  });

  return draftSlots.map((slot) => ({
    ...slot,
    userRanking: slot.preferences[0]?.ranking || null,
  }));
}
