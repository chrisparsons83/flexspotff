import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Link } from '~/components/ui/link';
import { PageHeader } from '~/components/ui/page-header';
import { getLatestBestBallLeague } from '~/models/bestball.server';
import { getLatestD12Season } from '~/models/d12season.server';
import { getLatestGuillotineLeagues } from '~/models/guillotine.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Side leagues' };

export const loader = async () => {
  const [guillotine, d12, bestBall] = await Promise.all([
    getLatestGuillotineLeagues(),
    getLatestD12Season(),
    getLatestBestBallLeague(),
  ]);
  return typedjson({
    guillotine,
    d12: d12 ? { year: d12.year } : null,
    bestBall: bestBall
      ? { year: bestBall.season.year, name: bestBall.name }
      : null,
  });
};

export default function SideLeagues() {
  const { guillotine, d12, bestBall } = useTypedLoaderData<typeof loader>();

  const sections = [
    {
      title: 'Guillotine',
      to: '/side-leagues/guillotine',
      description:
        'Every week the lowest-scoring team is chopped, and its whole roster goes to waivers.',
      current: guillotine
        ? guillotine.leagues.map(league => ({
            label: `${guillotine.year} ${league.name}`,
            to: `/side-leagues/guillotine/${league.id}`,
          }))
        : [],
    },
    {
      title: 'D12',
      to: '/side-leagues/d12',
      description: null,
      current: d12
        ? [
            {
              label: `${d12.year} standings`,
              to: `/side-leagues/d12/${d12.year}`,
            },
          ]
        : [],
    },
    {
      title: 'Autodraft BBM',
      to: '/side-leagues/best-ball',
      description:
        'The CPU drafts every roster, Sleeper plays the best lineup, and the most points for wins.',
      current: bestBall
        ? [
            {
              label: `${bestBall.year} ${bestBall.name}`,
              to: `/side-leagues/best-ball/${bestBall.year}`,
            },
          ]
        : [],
    },
  ];

  return (
    <>
      <PageHeader
        title='Side leagues'
        description='Separate fantasy leagues with their own drafts and rosters, run alongside the main ones.'
      />
      <div className='grid gap-6 md:grid-cols-3'>
        {sections.map(section => (
          <Card key={section.to}>
            <CardHeader>
              <CardTitle>
                <Link to={section.to} variant='quiet'>
                  {section.title}
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className='grid gap-4'>
              {section.description && (
                <p className='text-muted-foreground'>{section.description}</p>
              )}
              {section.current.length > 0 ? (
                <ul className='grid gap-1'>
                  {section.current.map(item => (
                    <li key={item.to}>
                      <Link to={item.to}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className='text-muted-foreground'>No season yet.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
