import CupBracket from './CupBracket';
import { EmptyState } from '~/components/ui/empty-state';
import { Section } from '~/components/ui/section';
import type { CupBracketData } from '~/libs/cup/bracket.server';
import type { RoundTotals } from '~/libs/cup/lineups';

/** A year's cup. The Leagues header's season picker moves between years. */
export default function CupPage({
  year,
  bracket,
  roundTotals,
}: {
  year: number;
  bracket: CupBracketData;
  roundTotals: RoundTotals;
}) {
  return (
    <Section title={`${year} Cup`}>
      {bracket ? (
        <CupBracket {...bracket} roundTotals={roundTotals} />
      ) : (
        <EmptyState title={`The ${year} cup has not been set up yet`} />
      )}
    </Section>
  );
}
