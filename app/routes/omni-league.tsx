import { Link, Outlet } from '@remix-run/react';

export default function OmniIndex() {
  const navigationLinks = [
    {
      name: 'Rules',
      href: '/omni-league/2025/rules',
      current: false,
    },
    {
      name: 'Draft Board',
      href: `/omni/2025/board`,
      current: false,
    },
    { name: 'Standings', href: '/omni-league/standings/2025', current: false },
    {
      name: 'Qualifying Points',
      href: '/omni-league/qualifying-points/2025/golfm',
      current: false,
    },
  ];

  return (
    <>
      <h2>Omni 2025</h2>
      <div className='grid md:grid-cols-12 md:gap-4'>
        <div className='not-prose text-sm md:col-span-2'>
          <section>
            <p
              id='admin-leagues-heading'
              className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
            >
              Leagues
            </p>
            <ul
              aria-labelledby='admin-leagues-heading'
              className='mb-8 space-y-2 p-0'
            >
              {navigationLinks.map(navLink => (
                <li key={navLink.name} className='flow-root'>
                  <Link
                    to={navLink.href}
                    className='block text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
                  >
                    {navLink.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className='md:col-span-10'>
          <Outlet />
        </div>
      </div>
    </>
  );
}
