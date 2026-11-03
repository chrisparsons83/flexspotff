import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { EmptyState } from '~/components/ui/empty-state';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { Table } from '~/components/ui/table';
import { placeAndScore, type DashboardSection } from '~/libs/dashboard/week';
import { getMemberWeek } from '~/libs/dashboard/week.server';
import { getCurrentSeason } from '~/models/season.server';
import { authenticator } from '~/services/auth.server';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  const season = await getCurrentSeason();
  return typedjson(
    season ? await getMemberWeek(user.id, season) : { rows: [] },
  );
};

const SECTIONS: DashboardSection[] = ['Leagues', 'Games', 'Side Leagues'];

export default function YourWeek() {
  const { rows } = useTypedLoaderData<typeof loader>();

  if (rows.length === 0) {
    return (
      <EmptyState title='Nothing on this week'>
        You are not in any leagues or games this season yet.
      </EmptyState>
    );
  }

  return (
    <>
      {SECTIONS.map(section => {
        const inSection = rows.filter(row => row.section === section);
        if (inSection.length === 0) return null;
        return (
          <Section key={section} title={section}>
            {section === 'Games' ? (
              <Table
                headers={[
                  'Game',
                  'This Week’s Entry',
                  'Last Week',
                  'Season Standing',
                ]}
                numericColumns={[2, 3]}
                primaryColumns={[1, 3]}
              >
                {inSection.map(row => (
                  <tr key={row.href}>
                    <td className='font-semibold'>
                      <Link to={row.href} variant='quiet'>
                        {row.label}
                      </Link>
                    </td>
                    <td>
                      {/* The same rule as a week still to enter: open,
                          and nothing in from them yet. */}
                      {row.enterHref ? (
                        <Link
                          to={row.enterHref}
                          className='font-semibold text-warning'
                        >
                          Not Entered
                        </Link>
                      ) : (
                        <span className='text-muted-foreground'>
                          {row.entry ?? '–'}
                        </span>
                      )}
                    </td>
                    <td className='text-right'>
                      {placeAndScore(row.lastWeekPlace, row.lastWeek) ?? '–'}
                    </td>
                    <td className='text-right'>
                      {placeAndScore(row.standing, row.season) ?? '–'}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : section === 'Side Leagues' ? (
              <Table
                headers={['Game', 'Last Week', 'Season Standing']}
                numericColumns={[1, 2]}
                primaryColumns={[2]}
              >
                {inSection.map(row => (
                  <tr key={row.href}>
                    <td className='font-semibold'>
                      <Link to={row.href} variant='quiet'>
                        {row.label}
                      </Link>
                    </td>
                    <td className='text-right'>{row.lastWeek ?? '–'}</td>
                    <td className='text-right'>{row.thisWeek ?? '–'}</td>
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
