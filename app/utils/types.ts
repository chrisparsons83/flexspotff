import z from 'zod';

// Doing this because Prisma hates me actually aggregating a sum based on connected fields.
export type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;

// Shared type guards for action data validation
// Type guard to check if action data is a success response with message
export function isSuccessWithMessage(
  actionData: any,
): actionData is { success: true; message: string } {
  return actionData?.success === true && 'message' in actionData;
}

// Type guard to check if action data is an error response
export function isErrorResponse(
  actionData: any,
): actionData is { success: false; error: any } {
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

// The /league/:id endpoint describes how the league was actually configured that
// year. Everything here is optional and the whole settings object is passthrough
// because Sleeper adds and removes settings between seasons - a missing key has
// to degrade to "we don't know" rather than fail the whole league sync.
export const sleeperLeagueJson = z.object({
  league_id: z.string(),
  season: z.string().optional(),
  status: z.string().optional(),
  bracket_id: z.union([z.string(), z.number()]).nullable().optional(),
  loser_bracket_id: z.union([z.string(), z.number()]).nullable().optional(),
  settings: z
    .object({
      playoff_week_start: z.number().optional(),
      league_average_match: z.number().optional(),
      playoff_teams: z.number().optional(),
      num_teams: z.number().optional(),
    })
    .passthrough()
    .optional(),
});
export type SleeperLeagueJson = z.infer<typeof sleeperLeagueJson>;

// The /league/:id/users endpoint is how we find out what a Sleeper owner ID is
// actually called, since we only ever store the ID on Team.
export const sleeperLeagueUsersJson = z.array(
  z.object({
    user_id: z.string(),
    username: z.string().nullish(),
    display_name: z.string().nullish(),
    metadata: z
      .object({
        team_name: z.string().nullish(),
      })
      .nullish(),
  }),
);
export type SleeperLeagueUsersJson = z.infer<typeof sleeperLeagueUsersJson>;
