/**
 * The weekly side games the automation converges, named as members see them.
 */
export type SideGame =
  | 'QB Streaming'
  | 'Spread Pool'
  | 'Locks Challenge'
  | 'DFS Survivor';

export type SideGameAction = {
  game: SideGame;
  week: number;
  detail?: string;
};

export type SideGameSyncReport = {
  message: string;
  scored: SideGameAction[];
  opened: SideGameAction[];
  /** Alert failures: the write landed, so these never fail the run. */
  warnings: string[];
  /** Per-week failures worth failing the run over. */
  errors: string[];
};

export type SideGameScoreOutcome =
  | {
      status: 'scored';
      detail?: string;
      /** A non-fatal problem after the score landed, e.g. a refresh failure. */
      warning?: string;
    }
  | { status: 'skipped' };

/**
 * One game's scoring half: decides whether it still owes a week a score, and
 * scores it if so. A module owns its own eligibility and writes; the
 * orchestrator only supplies the candidate weeks and reports what happened.
 */
export type SideGameScorer = {
  game: SideGame;
  scoreWeek(year: number, week: number): Promise<SideGameScoreOutcome>;
};

export type SideGameOpenOutcome =
  | { status: 'opened'; detail?: string }
  | { status: 'skipped' };

/**
 * One game's opening half: decides whether the coming week is due, and creates
 * and opens it if so. A module owns its own eligibility and writes; the
 * orchestrator only finds the coming week, syncs its slate and reports what
 * happened.
 */
export type SideGameOpener = {
  game: SideGame;
  openWeek(
    year: number,
    week: number,
    firstGameStart: Date,
    now: Date,
  ): Promise<SideGameOpenOutcome>;
};
