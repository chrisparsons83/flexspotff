import { ordinal } from './format';
import { TEXT } from './tones';
import clsx from 'clsx';

/**
 * Where a season ended - "3rd of 24", or "🏆 1st of 24" in gold for a title.
 * The trophy says it as well as the colour does. A season still being played
 * shows where it stands; the year beside it carries the Current tag.
 */
export default function SeasonFinish({
  finish,
  champion,
}: {
  finish: { rank: number; fieldSize: number; tied?: boolean } | null;
  champion: boolean;
}) {
  if (!finish) return <span className='text-slate-400'>—</span>;

  return (
    <span
      className={clsx(
        'whitespace-nowrap font-medium',
        champion ? TEXT.champion : 'text-slate-100',
      )}
    >
      {champion && '🏆 '}
      {finish.tied && 'T-'}
      {ordinal(finish.rank)}
      <span className='font-normal text-slate-400'> of {finish.fieldSize}</span>
    </span>
  );
}

/** The trophy count a Finishes card leads with: 🏆, or 🏆 × 3. */
export function Trophies({ titles }: { titles: number }) {
  return (
    <span className={TEXT.champion}>🏆{titles > 1 && ` × ${titles}`}</span>
  );
}
