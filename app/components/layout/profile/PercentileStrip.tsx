/**
 * Results on a bottom-to-top track, one translucent dot each, so where they
 * cluster shows as a darker patch. The average is the white tick.
 */
export default function PercentileStrip({
  values,
  average,
  label,
}: {
  /** Each result, 0 (bottom of the field) to 1 (top). */
  values: number[];
  average: number | null;
  /** Hover text for one dot. */
  label?: (value: number, index: number) => string;
}) {
  return (
    <div className='relative h-2 rounded-full bg-gradient-to-r from-rose-400/30 via-slate-600 to-emerald-400/30'>
      {values.map((value, index) => (
        <div
          key={index}
          title={label?.(value, index)}
          className='absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/40'
          style={{ left: `${value * 100}%` }}
        />
      ))}
      {average !== null && (
        <div
          aria-hidden='true'
          className='absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow'
          style={{ left: `${average * 100}%` }}
        />
      )}
    </div>
  );
}
