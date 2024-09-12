import type { LinksFunction, LoaderArgs } from '@remix-run/node';
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from '@remix-run/react';
import NavBar from '~/components/layout/NavBar';
import type { User } from '~/models/user.server';
import { authenticator, isEditor } from '~/services/auth.server';
import tailwindStylesheetUrl from '~/styles/tailwind.css';
import cssVariables from '~/styles/variables.css';
import { superjson, useSuperLoaderData } from '~/utils/data';

export const links: LinksFunction = () => {
  return [
    { rel: 'stylesheet', href: cssVariables },
    { rel: 'stylesheet', href: tailwindStylesheetUrl },
  ];
};

export const meta = () => {
  return [
    { charset: 'utf-8' },
    { title: 'Flex Spot FF' },
    { name: 'viewport', content: 'width=device-width,initial-scale=1' },
  ];
};

type LoaderData = {
  user: User | null;
  userIsEditor: boolean;
  ENV: {
    NODE_ENV: string;
  };
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request);
  const userIsEditor = !user ? false : isEditor(user);

  return superjson<LoaderData>(
    {
      user,
      userIsEditor,
      ENV: {
        NODE_ENV: process.env.NODE_ENV,
      },
    },
    { headers: { 'x-superjson': 'true' } },
  );
};

function App() {
  const { user, userIsEditor, ENV } = useSuperLoaderData<typeof loader>();

  return (
    <html lang='en' className='dark h-full'>
      <head>
        <Meta />
        <Links />
      </head>
      <body className='h-full bg-slate-700 text-white'>
        <NavBar user={user} userIsEditor={userIsEditor} />
        <div className='container relative mx-auto min-h-screen p-4 text-white'>
          <main className='prose max-w-none dark:prose-invert lg:prose-xl'>
            <Outlet />
          </main>
        </div>
        <ScrollRestoration />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(ENV)}`,
          }}
        />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export default App;

export function ErrorBoundary() {
  const error = useRouteError();

  // Don't forget to typecheck with your own logic.
  // Any value can be thrown, not just errors!
  let errorMessage = 'Unknown error';
  if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <html>
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body className='h-full bg-slate-700 text-white'>
        <NavBar user={null} userIsEditor={false} />
        <div className='container relative mx-auto min-h-screen p-4 text-white'>
          <main className='prose max-w-none dark:prose-invert lg:prose-xl'>
            <h1>Error</h1>
            <pre>{errorMessage}</pre>
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
