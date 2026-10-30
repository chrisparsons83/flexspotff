import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '~/components/ui/popover';
import { FOCUS_RING } from '~/components/ui/styles';
import type { Badge } from '~/models/profile/badges';
import { RIBBONS } from '~/styles/tokens/ribbons';
import { cn } from '~/utils';

/** What the stars say, for the popover and for screen readers. */
const starsMean = (badge: Badge) =>
  badge.scale === 'tally'
    ? `${badge.tier} ${badge.tier === 1 ? 'time' : 'times'}`
    : `Tier ${badge.tier} of ${badge.tierCount}`;

/**
 * One award ribbon, as the site has always drawn it: a tile of the badge's
 * own colour with a rule along the top and a notched tail, its emoji at the
 * top and its name and stars at the foot. The emoji sits a fixed distance
 * from the top and the name from the foot, with the slack between, so both
 * line up across a shelf whether a name takes one line or three. The notch is
 * a clip-path, so the tail keeps its shape at any width.
 */
export function Honour({ badge }: { badge: Badge }) {
  const ribbon = RIBBONS[badge.key];
  return (
    <span
      // check:patterns allow: the ribbons keep the old site's dark-page wash, which has no token
      className='flex h-full min-h-[7.75rem] w-full flex-col items-center border-t-4 bg-[var(--ribbon-solid)] px-0.5 text-center [clip-path:polygon(0_0,100%_0,100%_100%,50%_86%,0_100%)] dark:bg-[var(--ribbon-wash)]'
      style={{
        borderTopColor: ribbon?.edge,
        ['--ribbon-wash' as string]: ribbon?.wash,
        ['--ribbon-solid' as string]: ribbon?.solid,
      }}
    >
      <span aria-hidden='true' className='pt-2.5 text-2xl leading-none'>
        {ribbon?.emoji}
      </span>
      <span className='flex-1' />
      <span className='flex flex-col items-center gap-1 pb-6'>
        <span
          // check:patterns allow: the ribbons keep the pre-redesign look, small capitals included
          className='text-[9px] font-semibold uppercase leading-tight tracking-wide'
          style={{ color: ribbon?.label }}
        >
          {badge.label}
        </span>
        <span
          className='text-xs leading-none tracking-tighter'
          style={{ color: ribbon?.star }}
          aria-label={starsMean(badge)}
        >
          {/* check:patterns allow: a ribbon's stars, as the profile has always drawn them */}
          {'★'.repeat(badge.tier)}
        </span>
      </span>
    </span>
  );
}

/**
 * A member's awards as a shelf of ribbons, in the catalog's order. Each opens
 * on a tap to say what it is for, so the explanation reaches a phone too.
 */
export default function Honours({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) return null;

  return (
    // auto-rows-fr keeps every ribbon the height of the tallest, whatever
    // its name does.
    <ul className='not-prose mt-6 grid auto-rows-fr grid-cols-4 gap-1.5 p-0 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12'>
      {badges.map(badge => (
        <li key={badge.key} className='list-none'>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type='button'
                className={cn(
                  'block h-full w-full cursor-pointer transition-opacity duration-fast hover:opacity-90',
                  FOCUS_RING,
                )}
              >
                <Honour badge={badge} />
              </button>
            </PopoverTrigger>
            <PopoverContent className='w-64 text-sm'>
              <p className='m-0 font-semibold'>{badge.label}</p>
              <p className='m-0 mt-1 text-muted-foreground'>
                {badge.description}. {starsMean(badge)}.
              </p>
            </PopoverContent>
          </Popover>
        </li>
      ))}
    </ul>
  );
}
