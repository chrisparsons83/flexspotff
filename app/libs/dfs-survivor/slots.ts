/**
 * The eleven lineup slots of a DFS Survivor week, and which NFL positions may
 * fill each one. Shared by the entry route's loader, its action and the entry
 * UI so the rules can only be stated once.
 */
export const DFS_SURVIVOR_SLOTS = [
  'QB1',
  'QB2',
  'RB1',
  'RB2',
  'WR1',
  'WR2',
  'TE',
  'FLEX1',
  'FLEX2',
  'K',
  'DEF',
] as const;

export type DfsSurvivorSlot = (typeof DFS_SURVIVOR_SLOTS)[number];

const FLEX_POSITIONS = ['RB', 'WR', 'TE'];

export const SLOT_POSITIONS: Record<DfsSurvivorSlot, string[]> = {
  QB1: ['QB'],
  QB2: ['QB'],
  RB1: ['RB'],
  RB2: ['RB'],
  WR1: ['WR'],
  WR2: ['WR'],
  TE: ['TE'],
  FLEX1: FLEX_POSITIONS,
  FLEX2: FLEX_POSITIONS,
  K: ['K'],
  DEF: ['DEF'],
};

/** Every position that can appear in a lineup, for the player query. */
export const DFS_SURVIVOR_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

/** Weeks 1-17; DFS Survivor does not run through the NFL playoffs. */
export const DFS_SURVIVOR_LAST_WEEK = 17;

export function isDfsSurvivorSlot(value: string): value is DfsSurvivorSlot {
  return (DFS_SURVIVOR_SLOTS as readonly string[]).includes(value);
}

/**
 * "DEF" -> "D/ST", everything else unchanged.
 *
 * The digits are deliberately kept: stripping them left two rows both labelled
 * "QB" and two both labelled "FLEX", which is more confusing than the repeat.
 */
export function formatSlotName(slot: DfsSurvivorSlot): string {
  if (slot === 'DEF') return 'D/ST';
  return slot;
}
