import { Button } from './button';

/**
 * Opens a long list past its first few rows, and closes it again. `noun` is
 * what the list holds, plural: "Show all 40 opponents".
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
      {showAll ? 'Show fewer' : `Show all ${total} ${noun}`}
    </Button>
  );
}
