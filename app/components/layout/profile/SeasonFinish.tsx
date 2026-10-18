import { ordinal } from './format';
import { TEXT } from './tones';
import clsx from 'clsx';
import { Swatch } from '~/components/ui/swatch';

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
  if (!finish) return <span className='text-muted-foreground'>–</span>;

  return (
    <span
      className={clsx(
        'whitespace-nowrap font-medium',
        champion ? TEXT.champion : 'text-foreground',
      )}
    >
      {champion && <Swatch fill='medal-gold' className='mr-1.5' />}
      {finish.tied && 'T-'}
      {ordinal(finish.rank)}
      <span className='font-normal text-muted-foreground'>
        {' '}
        of {finish.fieldSize}
      </span>
    </span>
  );
}

/** The title count a Finishes card leads with: a gold square and the count. */
export function Trophies({ titles }: { titles: number }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5', TEXT.champion)}>
      <Swatch fill='medal-gold' />
      {titles}
      <span className='sr-only'>{titles === 1 ? 'title' : 'titles'}</span>
    </span>
  );
}
