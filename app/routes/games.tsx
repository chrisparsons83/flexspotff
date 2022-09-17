import type { LoaderArgs } from "@remix-run/node";
import { Link, Outlet } from "@remix-run/react";

import { getQBStreamingWeeks } from "~/models/qbstreamingweek.server";

import { CURRENT_YEAR } from "~/utils/constants";
import { superjson, useSuperLoaderData } from "~/utils/data";

const navigationLinks = [
  { name: "F²", href: "/games/f-squared", current: false },
  { name: "Survivor", href: "/games/survivor", current: false },
  { name: "Spread Pool", href: "/games/spread-pool", current: false },
];

type LoaderData = {
  qbStreamingCurrentWeek: number;
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const qbStreamingCurrentWeek = (await getQBStreamingWeeks(CURRENT_YEAR))[0]
    .week;

  return superjson<LoaderData>(
    {
      qbStreamingCurrentWeek,
    },
    { headers: { "x-superjson": "true" } }
  );
};

export default function GamesIndex() {
  const { qbStreamingCurrentWeek } = useSuperLoaderData<typeof loader>();

  const qbStreamingLinks = [
    { name: "Rules", href: "/games/qb-streaming/rules", current: false },
    { name: "My Entries", href: "/games/qb-streaming/entries", current: false },
    {
      name: "Overall Standings",
      href: `/games/qb-streaming/standings/${CURRENT_YEAR}`,
      current: false,
    },
    {
      name: "Weekly Standings",
      href: `/games/qb-streaming/standings/${CURRENT_YEAR}/${qbStreamingCurrentWeek}`,
      current: false,
    },
  ];

  return (
    <>
      <h2>FlexSpotFF Games</h2>
      <div className="grid md:grid-cols-12 md:gap-4">
        <div className="not-prose text-sm md:col-span-3">
          <section>
            <p
              id="admin-leagues-heading"
              className="mb-3 font-semibold text-slate-900 dark:text-slate-500"
            >
              Games
            </p>
            <ul
              aria-labelledby="admin-leagues-heading"
              className="mb-8 space-y-2 p-0"
            >
              {navigationLinks.map((navLink) => (
                <li key={navLink.name} className="flow-root">
                  <Link
                    to={navLink.href}
                    className="block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300"
                  >
                    {navLink.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <p
              id="admin-leagues-heading"
              className="mb-3 font-semibold text-slate-900 dark:text-slate-500"
            >
              QB Streaming Challenge
            </p>
            <ul
              aria-labelledby="admin-leagues-heading"
              className="mb-8 space-y-2 p-0"
            >
              {qbStreamingLinks.map((navLink) => (
                <li key={navLink.name} className="flow-root">
                  <Link
                    to={navLink.href}
                    className="block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300"
                  >
                    {navLink.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="md:col-span-9">
          <Outlet />
        </div>
      </div>
    </>
  );
}
