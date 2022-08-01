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
import { authenticator } from "./auth.server";
import type { User } from "./models/user.server";
import { superjson, useSuperLoaderData } from "./utils/data";

export const links: LinksFunction = () => {
  return [{ rel: "stylesheet", href: tailwindStylesheetUrl }];
};

export const meta: MetaFunction = () => ({
  charset: "utf-8",
  title: "Remix Notes",
  viewport: "width=device-width,initial-scale=1",
});

type LoaderData = {
  user: User | null;
};

export const loader = async ({ request }: LoaderArgs) => {
  return superjson<LoaderData>(
    {
      user: await authenticator.isAuthenticated(request),
    },
    { headers: { "x-superjson": "true" } }
  );
};

export default function App() {
  const { user } = useSuperLoaderData<typeof loader>();

  return (
    <html lang="en" className="dark h-full">
      <head>
        <Meta />
        <Links />
      </head>
      <body className="h-full bg-slate-700 text-white">
        <NavBar user={user} />
        <main className="container prose relative mx-auto min-h-screen p-4 text-white dark:prose-invert lg:prose-xl">
          <Outlet />
        </main>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}
