import { BAR } from './tones';

/**
 * Wins against losses (and ties) as one bar, in proportion. Wins always come
 * first and losses last, so the order says which is which as well as the
 * colour does.
 */
export default function SplitBar({
  wins,
  losses,
  ties = 0,
}: {
  wins: number;
  losses: number;
  ties?: number;
}) {
  const total = wins + losses + ties;
  const segments = [
    { value: wins, className: BAR.win },
    { value: ties, className: BAR.tie },
    { value: losses, className: BAR.loss },
  ];

  return (
    <div
      aria-hidden='true'
      className='flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-700'
    >
      {total > 0 &&
        segments
          .filter(segment => segment.value > 0)
          .map(segment => (
            <div
              key={segment.className}
              className={segment.className}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
    </div>
  );
}
