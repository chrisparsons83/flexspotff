/** Wins against losses (and ties) as one bar, in proportion. */
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
    { value: wins, className: 'bg-emerald-400' },
    { value: ties, className: 'bg-slate-400' },
    { value: losses, className: 'bg-rose-400' },
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
