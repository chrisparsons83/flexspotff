import stylesheet from './styles/tailwind.css?url';
import type { LinksFunction, LoaderFunctionArgs } from '@remix-run/node';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from '@remix-run/react';
import clsx from 'clsx';
import {
  typedjson,
  useTypedLoaderData,
  useTypedRouteLoaderData,
} from 'remix-typedjson';
import NavBar from '~/components/layout/NavBar';
import {
  canViewProfiles,
  getProfileHandles,
} from '~/models/profile/access.server';
import { authenticator, isEditor } from '~/services/auth.server';
import { getThemePreference } from '~/services/theme.server';
import { SYSTEM_THEME_SCRIPT, useThemeClass } from '~/utils/theme';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: stylesheet },
];

export const meta = () => {
  return [{ title: 'Flex Spot FF' }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const themePreference = getThemePreference(request);
  const user = await authenticator.isAuthenticated(request);
  const userIsEditor = !user ? false : isEditor(user);
  const currentPath = new URL(request.url).pathname;
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
    ENV: {
      NODE_ENV: process.env.NODE_ENV,
    },
    currentPath,
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

export default function App() {
  const { user, userIsEditor, canViewProfiles, ENV, currentPath } =
    useTypedLoaderData<typeof loader>();

  const regex = /omni\/\d{4}\/board$/gm;

  return (
    <>
      <NavBar
        user={user}
        userIsEditor={userIsEditor}
        canViewProfiles={canViewProfiles}
      />
      <div
        className={clsx(
          !regex.test(currentPath) && 'container',
          'relative mx-auto min-h-screen p-4',
        )}
      >
        <main className='prose max-w-none lg:prose-xl'>
          <Outlet />
        </main>
      </div>
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

  // Don't forget to typecheck with your own logic.
  // Any value can be thrown, not just errors!
  let errorMessage = 'Unknown error';
  if (error instanceof Error) {
    errorMessage = error.message;
  }

  // Layout wraps this, so it renders the page body only.
  return (
    <>
      <NavBar user={null} userIsEditor={false} canViewProfiles={false} />
      <div className='container relative mx-auto min-h-screen p-4'>
        <main className='prose max-w-none lg:prose-xl'>
          <h1>Error</h1>
          <pre>{errorMessage}</pre>
        </main>
      </div>
    </>
  );
}
