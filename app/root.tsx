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
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import NavBar from '~/components/layout/NavBar';
import { authenticator, isEditor } from '~/services/auth.server';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: stylesheet },
];

export const meta = () => {
  return [{ title: 'Flex Spot FF' }];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request);
  const userIsEditor = !user ? false : isEditor(user);

  return typedjson({
    user,
    userIsEditor,
    ENV: {
      NODE_ENV: process.env.NODE_ENV,
    },
  });
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' className='dark h-full'>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <Meta />
        <Links />
      </head>
      <body className='h-full bg-slate-700 text-white'>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { user, userIsEditor, ENV } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <NavBar user={user} userIsEditor={userIsEditor} />
      <div className='container relative mx-auto min-h-screen p-4 text-white'>
        <main className='prose max-w-none dark:prose-invert lg:prose-xl'>
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
