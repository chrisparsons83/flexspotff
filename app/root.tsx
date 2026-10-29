import stylesheet from './styles/tailwind.css?url';
import fontLatin from '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2?url';
import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
  useRouteError,
} from '@remix-run/react';
import clsx from 'clsx';
import { Fragment } from 'react';
import {
  typedjson,
  useTypedLoaderData,
  useTypedRouteLoaderData,
} from 'remix-typedjson';
import { AppShell } from '~/components/ui/app-shell';
import { Link } from '~/components/ui/link';
import { NAV_SECTIONS } from '~/components/ui/nav-bar';
import { PageHeader } from '~/components/ui/page-header';
import {
  canViewProfiles,
  getProfileHandles,
} from '~/models/profile/access.server';
import { authenticator, isEditor } from '~/services/auth.server';
import { getThemePreference } from '~/services/theme.server';
import { errorPage } from '~/utils/error-page';
import {
  SITE_NAME,
  breadcrumbs,
  pageTitle,
  socialMeta,
  usePageWidth,
} from '~/utils/route-handle';
import { SYSTEM_THEME_SCRIPT, useThemeClass } from '~/utils/theme';

export const links: LinksFunction = () => [
  // The Latin face is on every page, so fetch it before the CSS asks for it.
  {
    rel: 'preload',
    href: fontLatin,
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
  },
  { rel: 'stylesheet', href: stylesheet },
  { rel: 'icon', href: '/favicon.ico', sizes: '16x16' },
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const themePreference = getThemePreference(request);
  const user = await authenticator.isAuthenticated(request);
  const userIsEditor = !user ? false : isEditor(user);
  const profilesVisible = await canViewProfiles(user);

  return typedjson({
    user,
    userIsEditor,
    // Read by every link into a profile, so they drop to plain text while
    // profiles are admin-only. See useCanViewProfiles.
    canViewProfiles: profilesVisible,
    // What those links point at: /u/:handle, looked up by user id. See
    // useProfileHref.
    profileHandles: profilesVisible ? await getProfileHandles() : {},
    themePreference: await themePreference,
    // Link previews need full addresses.
    origin: process.env.WEBSITE_URL,
    ENV: {
      NODE_ENV: process.env.NODE_ENV,
    },
  });
};

export function Layout({ children }: { children: React.ReactNode }) {
  // Missing when the root loader itself failed; the error page is dark then.
  const themePreference =
    useTypedRouteLoaderData<typeof loader>('root')?.themePreference ?? 'dark';
  useThemeClass(themePreference);

  return (
    // The system script may change the class before hydration.
    <html
      lang='en'
      className={clsx(themePreference !== 'light' && 'dark', 'h-full')}
      suppressHydrationWarning
    >
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <PageTitle />
        <SocialMeta />
        {themePreference === 'system' && (
          <script dangerouslySetInnerHTML={{ __html: SYSTEM_THEME_SCRIPT }} />
        )}
        <Meta />
        <Links />
        {
          // script below fixes FOUC on Firefox
        }
        <script>let FF_FOUC_FIX;</script>
      </head>
      <body className='h-full bg-background text-foreground'>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

/**
 * The tab's title, from every route's `handle.title`. Read here rather than
 * in a `meta` export: Remix runs the root's `meta` before it has the child
 * routes.
 */
function PageTitle() {
  const matches = useMatches();
  const error = useRouteError();
  return (
    <title>
      {error ? `${errorPage(error).title} - ${SITE_NAME}` : pageTitle(matches)}
    </title>
  );
}

/** The link preview's tags. An error page gets none. */
function SocialMeta() {
  const matches = useMatches();
  const error = useRouteError();
  const origin = useTypedRouteLoaderData<typeof loader>('root')?.origin;
  if (error || !origin) return null;
  return socialMeta(matches, origin).map(tag =>
    'property' in tag ? (
      <meta key={tag.property} property={tag.property} content={tag.content} />
    ) : (
      <meta key={tag.name} name={tag.name} content={tag.content} />
    ),
  );
}

/**
 * Where a breadcrumb shows: the main nav's sections, and the dashboard.
 * Admin's side nav already marks the page and names it, and a profile keeps
 * its own tabs, so neither has one.
 */
const BREADCRUMB_SECTIONS = [
  ...NAV_SECTIONS,
  { label: 'Dashboard', to: '/dashboard' },
];

export default function App() {
  const { user, userIsEditor, canViewProfiles, themePreference, ENV } =
    useTypedLoaderData<typeof loader>();
  const width = usePageWidth();
  const matches = useMatches();

  return (
    <>
      <AppShell
        user={user}
        isEditor={userIsEditor}
        canViewProfiles={canViewProfiles}
        theme={themePreference}
        width={width}
        breadcrumbs={breadcrumbs(matches, BREADCRUMB_SECTIONS)}
      >
        <Outlet />
      </AppShell>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.ENV = ${JSON.stringify(ENV)}`,
        }}
      />
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  // Missing when the root loader itself failed.
  const root = useTypedRouteLoaderData<typeof loader>('root');
  const { title, message, detail } = errorPage(error);

  // Layout wraps this, so it renders the page body only.
  return (
    <AppShell
      user={root?.user ?? null}
      isEditor={root?.userIsEditor ?? false}
      canViewProfiles={root?.canViewProfiles ?? false}
      theme={root?.themePreference}
    >
      <PageHeader title={title} description={message} />
      {detail && import.meta.env.DEV && (
        <p className='mb-6 font-mono text-sm text-muted-foreground'>{detail}</p>
      )}
      <p className='max-w-prose'>
        Start again from the <Link to='/'>home page</Link>, or from{' '}
        {NAV_SECTIONS.map((section, index) => (
          <Fragment key={section.to}>
            {index > 0 && (index === NAV_SECTIONS.length - 1 ? ' or ' : ', ')}
            <Link to={section.to}>{section.label.toLowerCase()}</Link>
          </Fragment>
        ))}
        .
      </p>
    </AppShell>
  );
}
