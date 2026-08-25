type Props = {
  contest: string;
  memberName: string;
};

/**
 * Shown instead of hiding a tab, so the tab bar keeps the same shape on every
 * profile and "never played this" reads differently from "no data yet".
 */
export default function ContestEmptyState({ contest, memberName }: Props) {
  return (
    <p className='rounded-md bg-gray-800/50 px-4 py-8 text-center text-gray-400'>
      {memberName} hasn&rsquo;t played {contest}.
    </p>
  );
}
