import clsx from 'clsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { describeTier, type Badge } from '~/models/profile/badges';

type Props = {
  badges: Badge[];
};

/**
 * One award ribbon.
 *
 * Every badge carries its own colour rather than one keyed to how many stars
 * it has: the stars already say how far someone got, and colour-coding them too
 * turned a shelf of different awards into one ranked list. The colour lives on
 * the badge definition, next to its label and emoji, and it tints the ribbon's
 * background as well as its border - a shelf of grey tiles with coloured edges
 * read as one object with trim, rather than as separate awards.
 *
 * The emoji is measured from the top edge and the name and stars from the
 * foot, with the slack in between. Both ends then line up across the shelf
 * whether a label runs to one line or three - centring the emoji in the space
 * above the text made it drift up and down with the label instead.
 *
 * Only the stars a member actually earned are drawn. The hollow remainder that
 * used to follow them made every badge look half-finished, and a badge is a
 * thing you have rather than a progress bar - what the stars are worth is in
 * the tooltip instead.
 *
 * The notch at the foot is a clip-path on the tile rather than a border trick,
 * so the ribbon tail keeps its shape at any width. It only cuts the bottom
 * edge, which leaves the coloured top border intact.
 */
export function Ribbon({ badge }: { badge: Badge }) {
  return (
    <span
      className={clsx(
        'flex h-full w-full flex-col items-center px-0.5',
        'border-t-4 transition-opacity group-hover:opacity-90',
        badge.accent.border,
        badge.accent.bg,
        '[clip-path:polygon(0_0,100%_0,100%_100%,50%_86%,0_100%)]',
      )}
    >
      <span aria-hidden='true' className='pt-2.5 text-2xl leading-none'>
        {badge.emoji}
      </span>

      {/* All the slack lives here, so the emoji keeps its distance from the
          top edge while the name and stars keep theirs from the foot. */}
      <span className='flex-1' />

      <span className='flex flex-col items-center gap-1 pb-6'>
        <span
          className={clsx(
            'text-center text-[9px] font-semibold uppercase leading-tight tracking-wide',
            badge.accent.tone === 'light' ? 'text-amber-950' : 'text-slate-300',
          )}
        >
          {badge.label}
        </span>
        <span
          className={clsx(
            'text-xs leading-none tracking-tighter',
            badge.accent.text,
          )}
          aria-label={`Tier ${badge.tier} of ${badge.tierCount}`}
        >
          {'★'.repeat(badge.tier)}
        </span>
      </span>
    </span>
  );
}

export default function BadgeRow({ badges }: Props) {
  if (badges.length === 0) return null;

  return (
    // `auto-rows-fr` keeps every ribbon the same height whatever its label
    // does - "High Scoring Week" wraps to three lines where "Sacko" takes one,
    // and a fixed height would spill that third line past the notch.
    <ul className='not-prose mt-4 grid auto-rows-fr grid-cols-4 gap-1.5 p-0 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12'>
      {badges.map(badge => (
        <li key={badge.key} className='list-none'>
          <Popover>
            <PopoverTrigger asChild>
              {/* A click rather than a hover, so the explanation is reachable
                  on a phone as well as a desktop. */}
              <button
                type='button'
                className='group block h-full min-h-[7.75rem] w-full cursor-pointer'
              >
                <Ribbon badge={badge} />
              </button>
            </PopoverTrigger>
            {/* The popover's own `bg-popover` resolves to an undefined CSS
                variable in this app, which renders transparent - hence the
                explicit colours. */}
            <PopoverContent className='w-64 border-slate-600 bg-slate-900 p-3 text-sm text-slate-100'>
              <p className='m-0 font-semibold'>{badge.label}</p>
              <p className='m-0 mt-1 text-slate-300'>{describeTier(badge)}</p>
            </PopoverContent>
          </Popover>
        </li>
      ))}
    </ul>
  );
}
