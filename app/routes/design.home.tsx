import { Link } from '@remix-run/react';
import clsx from 'clsx';
import { MockShell } from '~/components/mocks/MockShell';
import {
  CURRENT_WEEK,
  LEAGUE_LEADERS,
  LEAGUES,
  PODCAST,
  YOUR_WEEK,
} from '~/components/mocks/data';
import {
  CLICKABLE,
  Panel,
  PANEL,
  PrimaryButton,
  Section,
  useMockHref,
} from '~/components/mocks/parts';
import { requireDesignMocks } from '~/services/design.server';

export const loader = () => requireDesignMocks();

/** Full class strings per league, so Tailwind can find them. */
const LEAGUE_BLOCKS: Record<string, { head: string; body: string }> = {
  champions: {
    head: 'bg-league-champions text-league-champions-foreground',
    body: 'bg-league-champions-tint',
  },
  admiral: {
    head: 'bg-league-admiral text-league-admiral-foreground',
    body: 'bg-league-admiral-tint',
  },
  dragon: {
    head: 'bg-league-dragon text-league-dragon-foreground',
    body: 'bg-league-dragon-tint',
  },
  galaxy: {
    head: 'bg-league-galaxy text-league-galaxy-foreground',
    body: 'bg-league-galaxy-tint',
  },
  monarch: {
    head: 'bg-league-monarch text-league-monarch-foreground',
    body: 'bg-league-monarch-tint',
  },
};

export default function DesignHome() {
  const href = useMockHref();

  return (
    <MockShell current='Home'>
      <div className='grid grid-cols-12 items-start gap-x-6 gap-y-10'>
        <div className='col-span-12 md:col-span-6 md:pt-6'>
          <h1 className='text-4xl font-extrabold tracking-tight'>
            Week {CURRENT_WEEK}
          </h1>
          <p className='mt-4 max-w-prose text-lg font-light'>
            Survivor picks lock Sunday at 1:00 pm Eastern.
          </p>
          <p className='mt-2 max-w-prose text-muted-foreground'>
            The Flex Spot runs five fantasy leagues and a set of weekly games
            for one Discord server.
          </p>
          <div className='mt-8'>
            <PrimaryButton>Make your survivor pick</PrimaryButton>
          </div>
        </div>
        <div className={clsx(PANEL, 'col-span-12 md:col-span-6')}>
          <h2 className='bg-secondary px-5 py-3 font-bold'>Your week</h2>
          <ul>
            {YOUR_WEEK.map(item => (
              <li
                key={item.game}
                className='grid grid-cols-[1fr_auto] items-center gap-4 border-t border-border px-5 py-3 first:border-t-0'
              >
                <span>
                  <span className='block font-semibold'>{item.game}</span>
                  <span className='block text-sm text-muted-foreground'>
                    {item.when}
                  </span>
                </span>
                <span
                  className={
                    item.done
                      ? 'text-sm text-muted-foreground'
                      : 'text-sm font-semibold text-brand'
                  }
                >
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Section title='League leaders' className='mt-16'>
        <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5'>
          {LEAGUES.map(league => (
            <Link
              key={league.key}
              to={href('/design/standings')}
              className={clsx(CLICKABLE, 'flex flex-col overflow-hidden')}
            >
              <h3
                className={`px-4 py-3 font-bold ${
                  LEAGUE_BLOCKS[league.key].head
                }`}
              >
                {league.name}
              </h3>
              <ol
                className={`flex-1 px-4 py-2 ${LEAGUE_BLOCKS[league.key].body}`}
              >
                {LEAGUE_LEADERS[league.key].map((leader, i) => (
                  <li
                    key={leader.manager}
                    className='grid grid-cols-[1.5rem_1fr_auto] py-2 text-sm'
                  >
                    <span className='text-muted-foreground'>{i + 1}</span>
                    <span>{leader.manager}</span>
                    <span className='font-semibold'>{leader.record}</span>
                  </li>
                ))}
              </ol>
            </Link>
          ))}
        </div>
      </Section>

      <Section title='Podcast' className='mt-16'>
        <Panel className='grid grid-cols-12 items-center gap-x-6 gap-y-2'>
          <p className='col-span-12 text-lg font-bold md:col-span-6'>
            {PODCAST.title}
          </p>
          <p className='col-span-6 text-muted-foreground md:col-span-2'>
            {PODCAST.date}
          </p>
          <p className='col-span-6 text-muted-foreground md:col-span-2'>
            {PODCAST.length}
          </p>
          <span className='col-span-12 md:col-span-2 md:text-right'>
            <PrimaryButton size='sm'>Listen</PrimaryButton>
          </span>
        </Panel>
      </Section>
    </MockShell>
  );
}
