import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { EmptyState } from '~/components/ui/empty-state';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import type { DashboardSection } from '~/libs/dashboard/week';
import { getMemberWeek } from '~/libs/dashboard/week.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  const season = await getCurrentSeason();
  return typedjson(
    season ? await getMemberWeek(user.id, season) : { todo: [], rows: [] },
  );
};

const SECTIONS: DashboardSection[] = ['Leagues', 'Games', 'Side Leagues'];

export default function YourWeek() {
  const { todo, rows } = useTypedLoaderData<typeof loader>();

  if (todo.length === 0 && rows.length === 0) {
    return (
      <EmptyState title='Nothing on this week'>
        You are not in any leagues or games this season yet.
      </EmptyState>
    );
  }

  return (
    <>
      {todo.length > 0 && (
        <Section title='Still to Do'>
          <ul className='grid gap-2'>
            {todo.map(item => (
              <li key={item.href} className='font-semibold'>
                <Link to={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {SECTIONS.map(section => {
        const inSection = rows.filter(row => row.section === section);
        if (inSection.length === 0) return null;
        return (
          <Section key={section} title={section}>
            {section === 'Games' ? (
              <Table
                headers={['Game', 'Standing', 'Season', 'Last Week']}
                numericColumns={[2]}
                primaryColumns={[1]}
              >
                {inSection.map(row => (
                  <tr key={row.href}>
                    <td className='font-semibold'>
                      <Link to={row.href} variant='quiet'>
                        {row.label}
                      </Link>
                    </td>
                    <td>{row.standing ?? '–'}</td>
                    <td className='text-right'>{row.season ?? '–'}</td>
                    <td className='text-muted-foreground'>
                      {row.lastWeek ?? '–'}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Table
                headers={['Game', 'Last Week', 'This Week']}
                primaryColumns={[2]}
              >
                {inSection.map(row => (
                  <tr key={row.href}>
                    <td className='font-semibold'>
                      <Link to={row.href} variant='quiet'>
                        {row.label}
                      </Link>
                    </td>
                    <td className='text-muted-foreground'>
                      {row.lastWeek ?? '–'}
                    </td>
                    <td>{row.thisWeek ?? '–'}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>
        );
      })}
    </>
  );
}
