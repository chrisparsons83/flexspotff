/**
 * The home page's one subject: goalposts at dusk with a kick going through.
 * Flat shapes in the four brand colours only (navy, coral, mustard, teal).
 * It is its own zone, so it keeps its colours in both themes.
 */
export function GoalpostsAtDusk({ className }: { className?: string }) {
  return (
    <svg
      viewBox='0 0 400 300'
      role='img'
      aria-label='Goalposts at dusk, with a ball sailing between the uprights'
      className={className}
    >
      {/* Sky, then a low sun that the field cuts off at the horizon. */}
      <rect width='400' height='300' className='fill-neutral-1' />
      <circle cx='200' cy='205' r='105' className='fill-brand-mustard' />

      {/* The field: teal, with three yard lines in navy. */}
      <rect y='205' width='400' height='95' className='fill-brand-teal' />
      <rect y='228' width='400' height='4' className='fill-neutral-1' />
      <rect y='256' width='400' height='4' className='fill-neutral-1' />
      <rect y='284' width='400' height='4' className='fill-neutral-1' />

      {/* The posts. */}
      <rect
        x='194'
        y='150'
        width='12'
        height='70'
        className='fill-brand-coral'
      />
      <rect
        x='110'
        y='140'
        width='180'
        height='12'
        className='fill-brand-coral'
      />
      <rect
        x='110'
        y='36'
        width='12'
        height='116'
        className='fill-brand-coral'
      />
      <rect
        x='278'
        y='36'
        width='12'
        height='116'
        className='fill-brand-coral'
      />

      {/* The kick, dead centre, with its trail. */}
      <g transform='rotate(-30 200 92)'>
        <ellipse
          cx='200'
          cy='92'
          rx='22'
          ry='13'
          className='fill-brand-coral'
        />
        <rect x='190' y='90' width='20' height='3' className='fill-neutral-1' />
      </g>
      <rect
        x='160'
        y='108'
        width='22'
        height='4'
        className='fill-brand-coral'
        transform='rotate(-30 171 110)'
      />
      <rect
        x='140'
        y='122'
        width='14'
        height='4'
        className='fill-brand-coral'
        transform='rotate(-30 147 124)'
      />
    </svg>
  );
}
