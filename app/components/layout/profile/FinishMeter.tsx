import { KeyedBar } from './BarKey';

/**
 * Finished seasons grouped by how they ended, lightest for the best, so the
 * bar reads the same without the gold. Each season sits in its best band
 * only, so a title is gold alone rather than also filling Top 3 and Top 5.
 */
const FINISH_BANDS = [
  { label: 'Won', max: 1, tone: 'bg-gold' },
  { label: 'Top 3', max: 3, tone: 'bg-slate-200' },
  { label: 'Top 5', max: 5, tone: 'bg-slate-400' },
  { label: '6th+', max: Infinity, tone: 'bg-slate-600' },
];

/** How a member's seasons have ended, as counts rather than a list of years. */
export default function FinishMeter({ ranks }: { ranks: number[] }) {
  return (
    <KeyedBar
      entries={FINISH_BANDS.map((band, index) => ({
        label: band.label,
        tone: band.tone,
        count: ranks.filter(
          rank =>
            rank <= band.max && rank > (FINISH_BANDS[index - 1]?.max ?? 0),
        ).length,
      }))}
    />
  );
}
