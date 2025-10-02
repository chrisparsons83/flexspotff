import { Link } from '@remix-run/react';

interface NavigationLink {
  name: string;
  href: string;
  current: boolean;
}

interface NavigationSectionProps {
  title: string;
  links: NavigationLink[];
  headingId?: string;
}

export function NavigationSection({
  title,
  links,
  headingId,
}: NavigationSectionProps) {
  const generatedId =
    headingId || `nav-${title.toLowerCase().replace(/\s+/g, '-')}-heading`;

  return (
    <section>
      <p
        id={generatedId}
        className='mb-3 font-semibold text-slate-900 dark:text-slate-500'
      >
        {title}
      </p>
      <ul aria-labelledby={generatedId} className='mb-8 space-y-2 p-0'>
        {links.map(navLink => (
          <li key={navLink.name} className='flow-root'>
            <Link
              to={navLink.href}
              className='text-slate-700 hover:text-slate-900 dark:text-slate-100 dark:hover:text-slate-300'
            >
              {navLink.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
