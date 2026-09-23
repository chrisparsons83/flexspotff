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

type Props = {
  userId: string;
  children: ReactNode;
};

/**
 * A link to a member's profile that drops to plain text for anyone who cannot
 * open it, so standings and records never link to a 404.
 */
export default function ProfileLink({ userId, children }: Props) {
  if (!useCanViewProfiles()) return <>{children}</>;

  return <Link to={`/members/${userId}/league`}>{children}</Link>;
}
