import type { LinksFunction, LoaderArgs, MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

import tailwindStylesheetUrl from "./styles/tailwind.css";
import NavBar from "./components/NavBar";
import { authenticator, isEditor } from "./auth.server";
import type { User } from "./models/user.server";
import { superjson, useSuperLoaderData } from "./utils/data";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: tailwindStylesheetUrl }];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Flex Spot FF",
  viewport: "width=device-width,initial-scale=1",
});

type LoaderData = {
  user: User | null;
  userIsEditor: boolean;
};

export const loader = async ({ request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request);
  const userIsEditor = !user ? false : isEditor(user);

  return superjson<LoaderData>(
    {
      user,
      userIsEditor,
    },
    { headers: { "x-superjson": "true" } }
  );
};

export default function App() {
  const { user, userIsEditor } = useSuperLoaderData<typeof loader>();

  return (
    <html lang="en" className="dark h-full">
      <head>
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-slate-700 text-white">
        <NavBar user={user} userIsEditor={userIsEditor} />
        <div className="container relative mx-auto min-h-screen p-4 text-white">
          <main className="prose max-w-none dark:prose-invert lg:prose-xl">
            <Outlet />
          </main>
        </div>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  return (
    <>
      <h1>Error</h1>
      <pre>{error.message}</pre>
    </>
  );
}
