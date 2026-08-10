import type { DraftSlotPreference } from '@prisma/client';
import { prisma } from '~/db.server';

export type { DraftSlotPreference } from '@prisma/client';

export type DraftSlotPreferenceWithDraftSlot = DraftSlotPreference & {
  draftSlot: {
    id: string;
    draftDateTime: Date;
  };
};

/**
 * Preferences for many users at once, grouped by user id. Callers sorting a
 * whole season would otherwise issue one query per player.
 *
 * Users with no preferences recorded are absent from the map rather than
 * present with an empty array, so callers can tell "picked nothing" apart from
 * "was not asked about".
 */
export async function getDraftSlotPreferencesByUser(
  userIds: string[],
  seasonId: string,
): Promise<Map<string, DraftSlotPreferenceWithDraftSlot[]>> {
  if (userIds.length === 0) return new Map();

  const preferences = await prisma.draftSlotPreference.findMany({
    where: {
      userId: { in: userIds },
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

  const byUser = new Map<string, DraftSlotPreferenceWithDraftSlot[]>();
  for (const preference of preferences) {
    const existing = byUser.get(preference.userId);
    if (existing) {
      existing.push(preference);
    } else {
      byUser.set(preference.userId, [preference]);
    }
  }

  return byUser;
}

export async function upsertUserDraftSlotPreferences(
  userId: string,
  seasonId: string,
  draftSlotIds: string[],
): Promise<void> {
  // Replace the user's preferences for this season atomically so a failed
  // insert can't leave them with no preferences.
  await prisma.$transaction([
    prisma.draftSlotPreference.deleteMany({
      where: {
        userId,
        seasonId,
      },
    }),
    prisma.draftSlotPreference.createMany({
      data: draftSlotIds.map(draftSlotId => ({
        userId,
        draftSlotId,
        seasonId,
      })),
    }),
  ]);
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

  return draftSlots.map(({ preferences, ...slot }) => ({
    ...slot,
    isSelected: preferences.length > 0,
  }));
}
