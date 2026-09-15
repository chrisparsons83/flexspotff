import z from 'zod';

/**
 * Every Sleeper payload shape we parse, in one place.
 *
 * These used to live in four: `app/utils/types.ts`, inline blocks at the top of
 * both sync libs, and copy-pasted stat schemas in two admin routes. The
 * duplicates had quietly drifted apart - see `sleeperMatchupJson` below.
 */

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

/**
 * Shared by the main-league and D12 add-league flows. Only `name` is
 * guaranteed: a league whose draft hasn't been created yet has no draft_id, and
 * the add-league flows read neither the roster shape nor the settings. Callers
 * that need any of the rest check for themselves rather than failing everyone
 * here with a ZodError.
 */
export const sleeperLeagueInfoJson = z.object({
  name: z.string(),
  season: z.string().nullish(),
  draft_id: z.string().nullish(),
  // The D12 leagues are best ball, which changes how a week is scored - see
  // app/libs/sleeper/best-ball.ts. Nullish because the main-league flows share
  // this schema and read neither.
  roster_positions: z.array(z.string()).nullish(),
  settings: z.object({ best_ball: z.number().nullish() }).nullish(),
});
export type SleeperLeagueInfoJson = z.infer<typeof sleeperLeagueInfoJson>;

/**
 * One matchup schema for both the main leagues and D12.
 *
 * The two previous copies disagreed on nullability: the leagues one declared
 * `points: z.number()` and `starters_points: z.array(z.number())`, so a roster
 * Sleeper hadn't scored yet would throw and abort the whole week's sync. The
 * permissive shape is the correct one, so it's what survives here.
 */
export const sleeperMatchupJson = z.array(
  z.object({
    roster_id: z.number(),
    points: z.number().nullable(),
    matchup_id: z.number().nullable(),
    starters: z.array(z.string().nullable()).nullable(),
    starters_points: z.array(z.number().nullable()).nullable(),
    // The whole roster's points, not just the starters'. Best-ball leagues are
    // scored off this rather than off `points`, which only ever sums the frozen
    // `starters` array.
    players_points: z.record(z.number().nullable()).nullish(),
  }),
);
export type SleeperMatchupJson = z.infer<typeof sleeperMatchupJson>;

export const sleeperRosterOwnersJson = z.array(
  z.object({
    roster_id: z.number(),
    owner_id: z.string().nullable(),
  }),
);
export type SleeperRosterOwnersJson = z.infer<typeof sleeperRosterOwnersJson>;

export const sleeperAdpJson = z.array(
  z.object({
    round: z.number(),
    roster_id: z.number(),
    player_id: z.string(),
    picked_by: z.string().nullable(),
    pick_no: z.number(),
  }),
);
export type SleeperAdpJson = z.infer<typeof sleeperAdpJson>;

export const sleeperDraftListJson = z.array(
  z.object({
    draft_id: z.string(),
    status: z.string(),
  }),
);
export type SleeperDraftListJson = z.infer<typeof sleeperDraftListJson>;

export const sleeperDraftPicksJson = z.array(
  z.object({
    player_id: z.string(),
    pick_no: z.number(),
    roster_id: z.number(),
  }),
);
export type SleeperDraftPicksJson = z.infer<typeof sleeperDraftPicksJson>;

export const sleeperNflPlayersJson = z.record(
  z.object({
    team: z.string().nullable(),
    position: z.string().nullable(),
    player_id: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    full_name: z.string().optional(),
  }),
);
export type SleeperNflPlayersJson = z.infer<typeof sleeperNflPlayersJson>;

export const sleeperNflStateJson = z.object({
  week: z.number(),
  season_type: z.string(),
  season_start_date: z.string().nullable(),
  season: z.string(),
  display_week: z.number(),
});
export type SleeperNflStateJson = z.infer<typeof sleeperNflStateJson>;

/**
 * Weekly stat lines. Every field is optional, so this single superset serves
 * both the QB streaming scorer (which reads the passing/rushing fields) and the
 * DFS survivor scorer (which also reads kicking and defense).
 */
export const sleeperStatsJson = z.record(
  z.object({
    pts_ppr: z.number().optional(),
    pass_yd: z.number().optional(),
    pass_td: z.number().optional(),
    rush_yd: z.number().optional(),
    rush_td: z.number().optional(),
    rec_yd: z.number().optional(),
    rec_td: z.number().optional(),
    rec: z.number().optional(),
    pass_int: z.number().optional(),
    fum_lost: z.number().optional(),
    rush_2pt: z.number().optional(),
    rec_2pt: z.number().optional(),
    pass_2pt: z.number().optional(),
    off_fum_rec_td: z.number().optional(),
    punt_ret_td: z.number().optional(),
    kick_ret_td: z.number().optional(),
    pts_allow: z.number().optional(),
    yds_allow: z.number().optional(),
    def_st_td: z.number().optional(),
    int: z.number().optional(),
    fum_rec: z.number().optional(),
    safe: z.number().optional(),
    sack: z.number().optional(),
    blk_kick: z.number().optional(),
    tkl_loss: z.number().optional(),
    fgm_0_19: z.number().optional(),
    fgm_20_29: z.number().optional(),
    fgm_30_39: z.number().optional(),
    fgm_40_49: z.number().optional(),
    fgm_50p: z.number().optional(),
    xpm: z.number().optional(),
    fgmiss: z.number().optional(),
    xpmiss: z.number().optional(),
  }),
);
export type SleeperStatsJson = z.infer<typeof sleeperStatsJson>;

/**
 * Rostership research, keyed by Sleeper player ID. Only `owned` is read, and
 * the entries are permissive because Sleeper adds fields to this one freely.
 */
export const sleeperRostershipJson = z.record(
  z.object({ owned: z.number().nullish() }).passthrough().nullable(),
);
export type SleeperRostershipJson = z.infer<typeof sleeperRostershipJson>;

/** Weekly projections, keyed by Sleeper player ID. */
export const sleeperProjectionsJson = z.record(
  z.object({ pts_half_ppr: z.number().nullish() }).passthrough().nullable(),
);
export type SleeperProjectionsJson = z.infer<typeof sleeperProjectionsJson>;

// The GraphQL scores query, which is the only NFL game feed Sleeper exposes.
export const sleeperGraphqlNflGames = z.object({
  scores: z.array(
    z.object({
      week: z.number(),
      status: z.string(),
      game_id: z.string(),
      metadata: z.object({
        home_team: z.string(),
        home_score: z.number().optional(),
        away_team: z.string(),
        away_score: z.number().optional(),
        date_time: z.string().datetime({ offset: true }),
      }),
    }),
  ),
});
export type SleeperGraphqlNflGames = z.infer<typeof sleeperGraphqlNflGames>;

/**
 * League transactions for one week.
 *
 * `settings` is nullable because trades and free agent adds carry no bid, so
 * every `waiver_bid` read must come after the `type === 'waiver'` filter.
 *
 * `adds`/`drops` map a player key to the roster it moved to or from. The key is
 * normally a numeric Sleeper player ID, but a defense arrives as a team
 * abbreviation ("DET"), which is also how our Player table stores them.
 */
export const sleeperTransactionsJson = z.array(
  z.object({
    type: z.string(),
    status: z.string(),
    transaction_id: z.string(),
    leg: z.number(),
    creator: z.string(),
    roster_ids: z.array(z.number()),
    settings: z.object({ waiver_bid: z.number(), seq: z.number() }).nullish(),
    metadata: z.object({ notes: z.string() }).nullish(),
    adds: z.record(z.number()).nullish(),
    drops: z.record(z.number()).nullish(),
    status_updated: z.number(),
  }),
);
export type SleeperTransactionsJson = z.infer<typeof sleeperTransactionsJson>;
export type SleeperTransaction = SleeperTransactionsJson[number];
