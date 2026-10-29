import type { ReactNode } from 'react';
import { useTypedRouteLoaderData } from 'remix-typedjson';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
import type { SubNavItem } from '~/components/ui/sub-nav';
import type { loader as rootLoader } from '~/root';

type Tabs = {
  /** The game's section, e.g. `/games/spread-pool`. */
  base: string;
  standings?: boolean;
  entries?: boolean;
  rules?: boolean;
  history?: boolean;
};

/**
 * Every game shares one shape: Overview, Standings, My entries (signed in
 * only), Rules and History. A tab the game has no page for is left out.
 */
export const gameTabs = ({
  base,
  standings = true,
  entries = true,
  rules = true,
  history = true,
}: Tabs): SubNavItem[] => [
  { label: 'Overview', to: base, end: true },
  ...(standings ? [{ label: 'Standings', to: `${base}/standings` }] : []),
  ...(entries ? [{ label: 'My Entries', to: `${base}/entries` }] : []),
  ...(rules ? [{ label: 'Rules', to: `${base}/rules` }] : []),
  ...(history ? [{ label: 'History', to: `${base}/history` }] : []),
];

/** The top of every page in a game: its name and its tabs. */
export default function GameHeader({
  title,
  description,
  actions,
  tabs,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  tabs: Tabs;
}) {
  // My entries is for members; a visitor would only be sent to log in.
  const signedIn = !!useTypedRouteLoaderData<typeof rootLoader>('root')?.user;
  return (
    <PageHeader
      title={title}
      description={description}
      actions={actions}
      nav={
        <SubNav
          label={title}
          items={gameTabs({
            ...tabs,
            entries: tabs.entries !== false && signedIn,
          })}
        />
      }
    />
  );
}
