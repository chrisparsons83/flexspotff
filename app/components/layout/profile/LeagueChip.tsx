import clsx from 'clsx';
import { RANK_COLORS, isLeagueName } from '~/utils/constants';

/** A league's name in its own colours, or neutral for one we do not know. */
export default function LeagueChip({ name }: { name: string }) {
  const key = name.toLocaleLowerCase();
  return (
    <span
      className={clsx(
        'rounded px-1.5 py-0.5 text-xs font-medium',
        isLeagueName(key) ? RANK_COLORS[key] : 'bg-slate-700 text-slate-100',
      )}
    >
      {name}
    </span>
  );
}
