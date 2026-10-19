import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import LocalDateTime from '~/components/ui/LocalDateTime';
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
  return typedjson({
    rows: season ? await getMemberWeek(user.id, season) : [],
  });
};

const SECTIONS: DashboardSection[] = ['Leagues', 'Side leagues', 'Games'];

export default function YourWeek() {
  const { rows } = useTypedLoaderData<typeof loader>();
  const todo = rows.filter(row => row.todo);
  const rest = rows.filter(row => !row.todo);

  if (rows.length === 0) {
    return (
      <EmptyState title='Nothing on this week'>
        You are not in any leagues or games this season yet.
      </EmptyState>
    );
  }

  return (
    <>
      {todo.length > 0 && (
        <Section
          title='Still to do'
          description='Everything you have not picked or entered for this week.'
        >
          <Table headers={['Game', 'This week', 'Locks']} primaryColumns={[1]}>
            {todo.map(row => (
              <tr key={row.href}>
                <td className='font-semibold'>
                  <Link to={row.href}>{row.label}</Link>
                </td>
                <td>{row.thisWeek}</td>
                <td className='text-muted-foreground'>
                  {row.deadline ? (
                    <>
                      From <LocalDateTime value={row.deadline} />
                    </>
                  ) : (
                    '–'
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Section>
      )}

      {SECTIONS.map(section => {
        const inSection = rest.filter(row => row.section === section);
        if (inSection.length === 0) return null;
        return (
          <Section key={section} title={section}>
            <Table
              headers={['Game', 'Last week', 'This week']}
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
          </Section>
        );
      })}
    </>
  );
}
