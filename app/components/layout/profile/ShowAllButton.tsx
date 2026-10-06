/**
 * Opens a long list past its first few rows, and closes it again. `noun` is
 * what the list holds, plural - "Show all 40 opponents".
 */
export default function ShowAllButton({
  total,
  noun,
  showAll,
  onToggle,
}: {
  total: number;
  noun: string;
  showAll: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type='button'
      aria-expanded={showAll}
      onClick={onToggle}
      className='mt-3 rounded bg-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-600'
    >
      {showAll ? 'Show fewer' : `Show all ${total} ${noun}`}
    </button>
  );
}
