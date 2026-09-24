/**
 * A W-L(-T) record with the dashes knocked back, so the numbers carry the
 * weight at display sizes. Ties are left off when there are none to show.
 */
export default function WinLoss({
  wins,
  losses,
  ties,
}: {
  wins: number;
  losses: number;
  ties?: number;
}) {
  const parts = ties ? [wins, losses, ties] : [wins, losses];
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && (
            <span className='mx-0.5 font-normal text-slate-500'>–</span>
          )}
          {part}
        </span>
      ))}
    </>
  );
}
