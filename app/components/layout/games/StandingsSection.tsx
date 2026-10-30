import type { ReactNode } from 'react';
import GoBox from '~/components/ui/GoBox';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';

/**
 * A game's standings, for a season or one week of it, with pickers for the
 * other seasons and weeks.
 */
export default function StandingsSection({
  base,
  year,
  week,
  years,
  weeks,
  description,
  children,
}: {
  /** The game's standings path, e.g. `/games/spread-pool/standings`. */
  base: string;
  year: number;
  /** Set on a week's standings. */
  week?: number;
  years: number[];
  /** The season's weeks with standings, newest first. */
  weeks: number[];
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section
      title={week ? `Week ${week}` : `${year} Standings`}
      description={description}
      action={
        <div className='flex flex-wrap items-center gap-3'>
          {week && <Link to={`${base}/${year}`}>{year} Season Standings</Link>}
          {weeks.length > 0 && (
            <GoBox
              buttonText='Week'
              options={weeks.map(option => ({
                label: `Week ${option}`,
                url: `${base}/${year}/${option}`,
              }))}
            />
          )}
          {years.length > 1 && (
            <GoBox
              buttonText='Season'
              options={years.map(option => ({
                label: `${option}`,
                url: `${base}/${option}`,
              }))}
            />
          )}
        </div>
      }
    >
      {children}
    </Section>
  );
}
