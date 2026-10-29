import MemberAvatar from './MemberAvatar';
import { Button } from './button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { FOCUS_RING, NAV_LABEL } from './styles';
import { ThemeToggle } from './theme-toggle';
import { Cross1Icon, HamburgerMenuIcon } from '@radix-ui/react-icons';
import { Form, Link, useLocation, useSubmit } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { Logo } from '~/components/brand/Logo';
import { cn } from '~/utils';
import type { ThemePreference } from '~/utils/theme';

/** The three sections, in the order the sitemap gives them. */
export const NAV_SECTIONS = [
  { label: 'Leagues', to: '/leagues' },
  { label: 'Games', to: '/games' },
  { label: 'Side leagues', to: '/side-leagues' },
] as const;

export type NavUser = {
  discordName: string;
  discordId: string;
  discordAvatar: string;
  discordUserAvatar?: string | null;
};

type Props = {
  user: NavUser | null;
  /** Shows Admin in the account menu. */
  isEditor: boolean;
  /** False while profiles are admin-only; hides Profile. */
  canViewProfiles: boolean;
  /** The visitor's theme, for the toggle. Leave it out to hide the toggle. */
  theme?: ThemePreference;
};

/** Whether the page is a section's landing page or anywhere inside it. */
const inSection = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(`${to}/`);

/** The account items, the same on desktop and mobile. */
function accountLinks({ isEditor, canViewProfiles }: Props) {
  return [
    { label: 'Dashboard', to: '/dashboard' },
    ...(canViewProfiles ? [{ label: 'Profile', to: '/me' }] : []),
    ...(isEditor ? [{ label: 'Admin', to: '/admin' }] : []),
  ];
}

/**
 * The site's bar: the logo home, the three sections, and the account menu or
 * Log in. The section you are in is marked on every page inside it, by its
 * name in the accent and the gradient's bar under it. The bar is what marks
 * it for anyone who cannot tell the accent from the other names. On a phone everything folds into one menu
 * button: the sections first, then the account items.
 */
export function NavBar(props: Props) {
  const { user, theme } = props;
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  // A link in the mobile menu navigates; the menu should not stay open over
  // the new page.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <header className='relative border-b border-hairline bg-chrome text-card-foreground'>
        <div className='mx-auto flex h-16 max-w-6xl items-stretch gap-8 px-4'>
          <Link
            to='/'
            aria-label='Flex Spot, home'
            className={cn('flex shrink-0 items-center', FOCUS_RING)}
          >
            {/* Centring the box would lift the name, since the box
                includes the bubble's tail; down 2px sits it on the nav
                labels' baseline. */}
            <Logo className='h-7 w-auto translate-y-0.5' />
          </Link>

          <nav aria-label='Main' className='hidden md:block'>
            <ul className='flex h-full'>
              {NAV_SECTIONS.map(section => {
                const current = inSection(pathname, section.to);
                return (
                  <li key={section.to} className='flex'>
                    <Link
                      to={section.to}
                      aria-current={
                        current
                          ? pathname === section.to
                            ? 'page'
                            : 'true'
                          : undefined
                      }
                      className={cn(
                        'flex items-center border-y-[3px] border-transparent px-3 font-semibold transition-colors duration-fast',
                        current
                          ? 'bg-accent-gradient bg-[length:100%_var(--nav-bar)] bg-bottom bg-no-repeat text-brand [background-origin:border-box]'
                          : 'text-muted-foreground hover:text-foreground',
                        NAV_LABEL,
                        FOCUS_RING,
                      )}
                    >
                      {section.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className='ml-auto hidden items-center gap-4 md:flex'>
            {theme && <ThemeToggle />}
            {user ? (
              <AccountMenu {...props} user={user} />
            ) : (
              <Button asChild variant='secondary' size='sm'>
                <Link to='/login'>Log in</Link>
              </Button>
            )}
          </div>

          <CollapsibleTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='my-auto ml-auto md:hidden'
              aria-label={open ? 'Close menu' : 'Menu'}
            >
              {open ? (
                <Cross1Icon aria-hidden />
              ) : (
                <HamburgerMenuIcon aria-hidden />
              )}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className='md:hidden'>
          <MobileMenu {...props} />
        </CollapsibleContent>
      </header>
    </Collapsible>
  );
}

function AccountMenu(props: Props & { user: NavUser }) {
  const { user } = props;
  // Submitted from the item rather than by a form inside the menu: choosing
  // an item closes the menu, which can take the form out of the page before
  // the browser submits it.
  const submit = useSubmit();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label='Account'
        className={cn('flex items-center', FOCUS_RING)}
      >
        <MemberAvatar user={user} size={32} />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{user.discordName}</DropdownMenuLabel>
        {accountLinks(props).map(item => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to}>{item.label}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => submit(null, { method: 'post', action: '/logout' })}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const MOBILE_ITEM =
  'block w-full px-4 py-3 text-left text-lg font-semibold no-underline';

function MobileMenu(props: Props) {
  const { user, theme } = props;
  const { pathname } = useLocation();

  return (
    <nav aria-label='Main' className='border-t border-border pb-4'>
      <ul>
        {NAV_SECTIONS.map(section => {
          const current = inSection(pathname, section.to);
          return (
            <li key={section.to}>
              <Link
                to={section.to}
                aria-current={current ? 'true' : undefined}
                className={cn(
                  MOBILE_ITEM,
                  current && 'bg-secondary text-secondary-foreground',
                  FOCUS_RING,
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <ul className='mt-2 border-t border-border pt-2'>
        {user ? (
          <>
            {accountLinks(props).map(item => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(MOBILE_ITEM, 'font-normal', FOCUS_RING)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Form method='post' action='/logout'>
                <button
                  type='submit'
                  className={cn(MOBILE_ITEM, 'font-normal', FOCUS_RING)}
                >
                  Log out
                </button>
              </Form>
            </li>
          </>
        ) : (
          <li>
            <Link to='/login' className={cn(MOBILE_ITEM, FOCUS_RING)}>
              Log in
            </Link>
          </li>
        )}
      </ul>
      {theme && <ThemeToggle className='px-4 pt-2' />}
    </nav>
  );
}
