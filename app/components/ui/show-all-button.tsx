import { Button } from './button';

const titleCase = (words: string) =>
  words.replace(/\b[a-z]/g, letter => letter.toUpperCase());

/**
 * Opens a long list past its first few rows, and closes it again. `noun` is
 * what the list holds, plural: "Show All 40 Opponents".
 */
export function ShowAllButton({
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
    <Button
      variant='secondary'
      size='sm'
      aria-expanded={showAll}
      onClick={onToggle}
      className='mt-4'
    >
      {showAll ? 'Show Fewer' : `Show All ${total} ${titleCase(noun)}`}
    </Button>
  );
}
