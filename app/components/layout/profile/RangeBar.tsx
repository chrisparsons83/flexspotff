/**
 * Worst to best as a track, with the average marked on it - how far a typical
 * week sits from the floor and the ceiling.
 */
export default function RangeBar({
  low,
  high,
  mark,
}: {
  low: number;
  high: number;
  mark: number;
}) {
  const position = high > low ? ((mark - low) / (high - low)) * 100 : 50;

  return (
    <div
      aria-hidden='true'
      className='relative h-2 rounded-full bg-gradient-to-r from-rose-400/80 via-slate-500 to-emerald-400/80'
    >
      <div
        className='absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow'
        style={{ left: `${position}%` }}
      />
    </div>
  );
}
