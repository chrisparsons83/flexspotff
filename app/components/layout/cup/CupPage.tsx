import CupBracket from './CupBracket';
import GoBox from '~/components/ui/GoBox';
import { EmptyState } from '~/components/ui/empty-state';
import { Section } from '~/components/ui/section';
import type { CupBracketData } from '~/libs/cup/bracket.server';

/** A year's cup, with a picker for the others. */
export default function CupPage({
  year,
  bracket,
  years,
}: {
  year: number;
  bracket: CupBracketData;
  years: number[];
}) {
  return (
    <Section
      title={`${year} cup`}
      action={
        years.length > 0 && (
          <GoBox
            buttonText='Season'
            options={years.map(cupYear => ({
              label: `${cupYear}`,
              url: `/leagues/cup/${cupYear}`,
            }))}
          />
        )
      }
    >
      {bracket ? (
        <CupBracket {...bracket} />
      ) : (
        <EmptyState title={`The ${year} cup has not been set up yet`} />
      )}
    </Section>
  );
}
