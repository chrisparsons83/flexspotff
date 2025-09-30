import z from 'zod';

// Doing this because Prisma hates me actually aggregating a sum based on connected fields.
export type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;

// Shared type guards for action data validation
// Type guard to check if action data is a success response with message
export function isSuccessWithMessage(actionData: any): actionData is { success: true; message: string } {
  return actionData?.success === true && 'message' in actionData;
}

// Type guard to check if action data is an error response
export function isErrorResponse(actionData: any): actionData is { success: false; error: any } {
  return actionData?.success === false && 'error' in actionData;
}

// Sleeper API Schemas
export const sleeperTeamJson = z.array(
  z.object({
    league_id: z.string(),
    roster_id: z.number(),
    owner_id: z.string().nullable(),
    settings: z.object({
      wins: z.number(),
      losses: z.number(),
      ties: z.number(),
      total_moves: z.number(),
      waiver_budget_used: z.number(),
      fpts: z.number().optional(),
      fpts_decimal: z.number().optional(),
      fpts_against: z.number().optional(),
      fpts_against_decimal: z.number().optional(),
    }),
    metadata: z
      .object({
        streak: z.string().optional(),
        record: z.string().optional(),
      })
      .nullable(),
  }),
);
export type SleeperTeamJson = z.infer<typeof sleeperTeamJson>;

export const sleeperDraftJson = z.object({
  status: z.string(),
  season: z.string(),
  start_time: z.number().nullable(),
  draft_order: z.record(z.number()).nullable(),
});
export type SleeperDraftJson = z.infer<typeof sleeperDraftJson>;
