import { Link } from '@remix-run/react';
import type { ReactNode } from 'react';
import { useTypedRouteLoaderData } from 'remix-typedjson';
import type { loader as rootLoader } from '~/root';

/**
 * Whether the signed-in member can open profiles, from the root loader. False
 * while the memberProfiles flag is off, for everyone but admins.
 */
export function useCanViewProfiles(): boolean {
  const data = useTypedRouteLoaderData<typeof rootLoader>('root');
  return data?.canViewProfiles ?? false;
}

/**
 * The path to a member's profile tab, /u/:handle/:tab, from just their user
 * id. A member the root loader's handle list has not heard of yet - created
 * since the page loaded - falls back to /members/:id, which redirects.
 */
export function useProfileHref() {
  const data = useTypedRouteLoaderData<typeof rootLoader>('root');
  const handles = data?.profileHandles ?? {};

  return (userId: string, tab = 'league') => {
    const handle = handles[userId];
    return handle ? `/u/${handle}/${tab}` : `/members/${userId}/${tab}`;
  };
}

type Props = {
  userId: string;
  tab?: string;
  className?: string;
  children: ReactNode;
};

/**
 * A link to a member's profile that drops to plain text for anyone who cannot
 * open it, so standings and records never link to a 404.
 */
export default function ProfileLink({
  userId,
  tab,
  className,
  children,
}: Props) {
  const profileHref = useProfileHref();
  if (!useCanViewProfiles()) return <>{children}</>;

  return (
    <Link to={profileHref(userId, tab)} className={className}>
      {children}
    </Link>
  );
}
