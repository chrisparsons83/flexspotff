import { Link, Outlet } from "@remix-run/react";

const navigationLinks = [
  { name: "F²", href: "/games/f-squared", current: false },
  { name: "Streaming Challenge", href: "/games/streaming", current: false },
  { name: "Survivor", href: "/games/survivor", current: false },
];

export default function GamesIndex() {
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
        </div>
        <div className="md:col-span-9">
          <Outlet />
        </div>
      </div>
    </>
  );
}
