import { EmptyState } from '~/components/ui/empty-state';

type Props = {
  /** The game as it reads in a sentence: "the Spread Pool", "D12". */
  contest: string;
  memberName: string;
};

/**
 * Shown instead of hiding a tab, so the tab bar keeps the same shape on every
 * profile and "never played this" reads differently from "no data yet".
 */
export default function ContestEmptyState({ contest, memberName }: Props) {
  return <EmptyState title={`${memberName} hasn’t played ${contest} yet.`} />;
}
