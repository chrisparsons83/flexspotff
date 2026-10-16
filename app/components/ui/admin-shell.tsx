import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible';
import { FOCUS_RING } from './styles';
import { Link, useLocation } from '@remix-run/react';
import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '~/utils';

/** Who can see an admin page: admins, or podcast editors. */
export type AdminRole = 'admin' | 'podcast';

/** `null` is every editor. */
export type AdminNavItem = {
  label: string;
  to: string;
  role: AdminRole | null;
};

export type AdminNavGroup = { title: string; items: AdminNavItem[] };

/**
 * The admin pages grouped by task, as the sitemap sets out. Items are for
 * admins unless they say otherwise; the admin home is for every editor.
 */
const groups: {
  title: string;
  items: (Omit<AdminNavItem, 'role'> & { role?: AdminRole | null })[];
}[] = [
  {
    title: 'This week',
    items: [
      { label: 'Admin home', to: '/admin', role: null },
      { label: 'Spread pool weeks', to: '/admin/spread-pool' },
      { label: 'QB streaming weeks', to: '/admin/qb-streaming' },
      { label: 'Locks challenge', to: '/admin/locks-challenge' },
      { label: 'DFS survivor', to: '/admin/dfs-survivor' },
      { label: 'Waiver reports', to: '/admin/waivers' },
    ],
  },
  {
    title: 'Season setup',
    items: [
      { label: 'Seasons', to: '/admin/season' },
      { label: 'Registration list', to: '/admin/registration-list' },
      { label: 'Draft slots', to: '/admin/draft-slots' },
      { label: 'Leagues', to: '/admin/leagues' },
      { label: 'Cups', to: '/admin/cups' },
      { label: 'D12', to: '/admin/d12' },
      { label: 'Guillotine', to: '/admin/guillotine' },
      { label: 'Autodraft BBM', to: '/admin/best-ball' },
      { label: 'Survivor pools', to: '/admin/survivor' },
    ],
  },
  {
    title: 'Members',
    items: [
      { label: 'Members', to: '/admin/members' },
      { label: 'Unmatched Sleeper users', to: '/admin/members/unmatched' },
      { label: 'Merge duplicates', to: '/admin/members/merge' },
      { label: 'Add members', to: '/admin/members/add' },
    ],
  },
  {
    title: 'Syncs and data',
    items: [
      { label: 'Syncing', to: '/admin/data' },
      { label: 'Scheduler', to: '/admin/scheduler' },
      { label: 'F² history import', to: '/admin/f-squared/import' },
      { label: 'QB streaming import', to: '/admin/qb-streaming/import' },
      { label: 'Bot commands', to: '/admin/bot' },
    ],
  },
  {
    title: 'Archive',
    items: [
      { label: 'Omni scoring', to: '/admin/omni/scoring' },
      {
        label: 'Omni qualifying points',
        to: '/admin/omni/qualifying-points',
      },
      { label: 'Omni players', to: '/admin/omni/add-player' },
      { label: 'Podcasts', to: '/admin/podcasts', role: 'podcast' },
    ],
  },
];

export const ADMIN_NAV: AdminNavGroup[] = groups.map(group => ({
  ...group,
  items: group.items.map(item => ({
    ...item,
    role: item.role === undefined ? 'admin' : item.role,
  })),
}));

/**
 * The groups with only what these roles can open, and no empty groups. The
 * admin home has no role, so every editor sees it.
 */
export const adminNavFor = (roles: AdminRole[]) =>
  ADMIN_NAV.map(group => ({
    ...group,
    items: group.items.filter(item => !item.role || roles.includes(item.role)),
  })).filter(group => group.items.length > 0);

/**
 * The page an admin link belongs to: the longest link the path starts with,
 * so /admin/members/merge marks Merge duplicates rather than Members.
 */
const currentLink = (groups: AdminNavGroup[], pathname: string) =>
  groups
    .flatMap(group => group.items.map(item => item.to))
    .filter(to => pathname === to || pathname.startsWith(`${to}/`))
    .sort((a, b) => b.length - a.length)[0];

type Props = {
  groups: AdminNavGroup[];
  children: ReactNode;
};

/**
 * Admin's frame: the pages grouped by task down the side, the page beside
 * them. On a phone the groups fold into one button above the page.
 */
export function AdminShell({ groups, children }: Props) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const current = currentLink(groups, pathname);

  useEffect(() => setOpen(false), [pathname]);

  const nav = (
    <nav aria-label='Admin'>
      {groups.map(group => (
        <section key={group.title} className='mb-8 last:mb-0'>
          <h2 className='mb-2 px-3 text-sm text-muted-foreground'>
            {group.title}
          </h2>
          <ul>
            {group.items.map(item => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={item.to === current ? 'page' : undefined}
                  className={cn(
                    'block px-3 py-1.5 no-underline transition-colors duration-fast',
                    item.to === current
                      ? 'bg-secondary font-semibold text-secondary-foreground'
                      : 'text-foreground hover:bg-secondary/60',
                    FOCUS_RING,
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );

  return (
    <div className='grid grid-cols-12 gap-x-6 gap-y-6'>
      <div className='col-span-12 lg:hidden'>
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className='bg-card px-4'>
            Admin pages
          </CollapsibleTrigger>
          <CollapsibleContent className='bg-card py-4'>
            {nav}
          </CollapsibleContent>
        </Collapsible>
      </div>
      <aside className='hidden lg:col-span-3 lg:block'>{nav}</aside>
      <div className='col-span-12 min-w-0 lg:col-span-9'>{children}</div>
    </div>
  );
}
