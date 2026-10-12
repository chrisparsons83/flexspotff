import { Link } from '@remix-run/react';
import clsx from 'clsx';
import { MockShell } from '~/components/mocks/MockShell';
import {
  CHAMPIONS_STANDINGS,
  CURRENT_WEEK,
  LEAGUES,
  PLAYOFF_SPOTS,
  type Result,
} from '~/components/mocks/data';
import { Panel, Square, SubNav } from '~/components/mocks/parts';
import { requireDesignMocks } from '~/services/design.server';

export const loader = () => requireDesignMocks();

const SECTION_PAGES = [
  'Overview',
  'Standings',
  'Leaderboard',
  'Cup',
  'Records',
  'Rules',
].map(label => ({ label, to: '/design/standings' }));

/** Wins are filled squares, losses are outlines: form, not colour. */
function LastSix({ results }: { results: Result[] }) {
  return (
    <span
      className='flex gap-1'
      role='img'
      aria-label={`Last six: ${results
        .map(r => (r === 'W' ? 'win' : 'loss'))
        .join(', ')}`}
    >
      {results.map((result, i) => (
        <span
          key={i}
          className={clsx(
            'size-3 border border-foreground',
            result === 'W' && 'bg-foreground',
          )}
        />
      ))}
    </span>
  );
}

/** Points for as a bar across the league's range, in the league's colour. */
function PointsBar({
  value,
  min,
  max,
}: {
  value: number;
  min: number;
  max: number;
}) {
  // Every team level (say, before week one) fills the bar to the same share.
  const share = max > min ? (value - min) / (max - min) : 1;
  return (
    <span className='flex items-center gap-3'>
      <span className='w-16 shrink-0'>{value.toFixed(1)}</span>
      <span className='hidden h-2 w-24 bg-secondary sm:block' aria-hidden>
        <span
          className='block h-2 bg-league-champions'
          style={{ width: `${Math.round(10 + share * 90)}%` }}
        />
      </span>
    </span>
  );
}

export default function DesignStandings() {
  const points = CHAMPIONS_STANDINGS.map(row => row.pointsFor);
  const min = Math.min(...points);
  const max = Math.max(...points);

  return (
    <MockShell current='Leagues'>
      <Panel tone='bg-league-champions-tint' className='p-8'>
        <h1 className='text-4xl font-extrabold tracking-tight'>
          Champions league
        </h1>
        <p className='mt-2 text-muted-foreground'>
          The top tier. Twelve teams, six make the playoffs.
        </p>
        <nav aria-label='League' className='mt-8'>
          <ul className='flex flex-wrap gap-3'>
            {LEAGUES.map(league => (
              <li key={league.key}>
                <Link
                  to={'/design/standings'}
                  aria-current={league.key === 'champions' ? 'page' : undefined}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 text-sm transition-colors duration-fast',
                    league.key === 'champions'
                      ? 'bg-league-champions font-bold text-league-champions-foreground'
                      : 'bg-background/60 hover:bg-secondary',
                  )}
                >
                  {league.key !== 'champions' && <Square fill={league.fill} />}
                  {league.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Panel>

      <div className='mt-8'>
        <SubNav items={SECTION_PAGES} current='Standings' />
      </div>

      <div className='mt-10 flex flex-wrap items-baseline justify-between gap-4'>
        <h2 className='text-xl font-bold'>Standings</h2>
        <p className='text-sm text-muted-foreground'>
          2026 season, after week {CURRENT_WEEK}
        </p>
      </div>

      <Panel className='mt-6 overflow-x-auto p-4'>
        <table className='w-full min-w-[40rem] text-left'>
          <thead className='text-sm text-muted-foreground'>
            <tr>
              <th className='w-12 pb-2 pl-3 font-normal'>
                <span className='sr-only'>Rank</span>
              </th>
              <th className='pb-2 pr-6 font-normal'>Manager</th>
              <th className='pb-2 pr-6 font-normal'>Record</th>
              <th className='pb-2 pr-6 font-normal'>Median</th>
              <th className='pb-2 pr-6 font-normal'>Points for</th>
              <th className='pb-2 pr-6 font-normal'>Points against</th>
              <th className='pb-2 font-normal'>Last six</th>
            </tr>
          </thead>
          <tbody>
            {CHAMPIONS_STANDINGS.map((row, i) => (
              <tr
                key={row.manager}
                className={clsx(
                  'border-t',
                  i === PLAYOFF_SPOTS
                    ? 'border-t-2 border-foreground'
                    : 'border-border',
                  i < PLAYOFF_SPOTS && 'bg-league-champions-tint',
                )}
              >
                <td className='py-3 pl-3 text-muted-foreground'>{i + 1}</td>
                <td className='py-3 pr-6 font-semibold'>{row.manager}</td>
                <td className='py-3 pr-6'>
                  {row.wins}-{row.losses}
                </td>
                <td className='py-3 pr-6'>
                  {row.medianWins}-{row.medianLosses}
                </td>
                <td className='py-3 pr-6'>
                  <PointsBar value={row.pointsFor} min={min} max={max} />
                </td>
                <td className='py-3 pr-6'>{row.pointsAgainst.toFixed(1)}</td>
                <td className='py-3'>
                  <LastSix results={row.lastSix} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <p className='mt-4 text-sm text-muted-foreground'>
        The top {PLAYOFF_SPOTS}, on the tinted rows, make the playoffs.
      </p>
    </MockShell>
  );
}
