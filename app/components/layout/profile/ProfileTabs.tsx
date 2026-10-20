import { SubNav } from '~/components/ui/sub-nav';

/**
 * The profile tab bar.
 *
 * These are links rather than a client-side tab component so each tab is its own
 * route with its own loader - opening a profile queries one contest instead of
 * all of them, and every tab can be linked to directly.
 *
 * Only contests a member actually played are shown. A row of tabs leading to
 * "hasn't played this" is noise, and it reads the same whether they skipped the
 * game or it did not exist during their seasons.
 */

export const PROFILE_TABS = [
  { key: 'league', label: 'League' },
  { key: 'cup', label: 'Cup' },
  { key: 'd12', label: 'D12' },
  { key: 'guillotine', label: 'Guillotine' },
  { key: 'best-ball', label: 'Autodraft BBM' },
  { key: 'survivor', label: 'Survivor' },
  { key: 'qb-streaming', label: 'QB streaming' },
  { key: 'spread-pool', label: 'Spread pool' },
  { key: 'locks', label: 'Locks' },
  { key: 'dfs-survivor', label: 'DFS survivor' },
  { key: 'f-squared', label: 'F²' },
] as const;

/** Always shown, so a profile is never left with no tabs at all. */
const ALWAYS_SHOWN = 'league';

type Props = {
  handle: string;
  contestsPlayed: string[];
};

/**
 * Set along the foot of the hero, so the member's header and the way around
 * their profile read as one unit. Scrolls sideways on a phone rather than
 * wrapping into a second row.
 */
export default function ProfileTabs({ handle, contestsPlayed }: Props) {
  const played = new Set(contestsPlayed);
  const visible = PROFILE_TABS.filter(
    tab => tab.key === ALWAYS_SHOWN || played.has(tab.key),
  );

  return (
    <SubNav
      label='Profile sections'
      className='not-prose px-4 pb-4 md:px-6 md:pb-6'
      items={visible.map(tab => ({
        label: tab.label,
        to: `/u/${handle}/${tab.key}`,
      }))}
    />
  );
}
