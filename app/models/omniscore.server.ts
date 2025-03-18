import type { OmniScore } from '@prisma/client';
import { prisma } from '~/db.server';

export type OmniScoreCreate = Omit<OmniScore, 'id' | 'createdAt' | 'updatedAt'>;

export async function createOmniScore(data: OmniScoreCreate) {
  return prisma.omniScore.create({
    data,
  });
}
