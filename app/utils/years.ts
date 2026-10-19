import type { GoBoxMenuItem } from '~/components/ui/GoBox';
import { FIRST_YEAR } from '~/utils/constants';

/** Every season from the first on record to `last`, newest first, as GoBox options. */
export const yearOptions = (
  last: number,
  url: (year: number) => string,
  first = FIRST_YEAR,
): GoBoxMenuItem[] =>
  Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => last - i).map(
    year => ({ label: `${year}`, url: url(year) }),
  );
