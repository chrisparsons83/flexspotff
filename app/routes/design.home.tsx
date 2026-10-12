import { GoalpostsAtDusk } from '~/components/mocks/GoalpostsAtDusk';
import { MockShell } from '~/components/mocks/MockShell';
import {
  CURRENT_WEEK,
  LEAGUE_LEADERS,
  LEAGUES,
  PODCAST,
  THIS_WEEK,
} from '~/components/mocks/data';
import { Panel, PrimaryButton, Section } from '~/components/mocks/parts';
import { requireDesignMocks } from '~/services/design.server';

export const loader = () => requireDesignMocks();

/** Full class strings per league, so Tailwind can find them. */
const LEAGUE_BLOCKS: Record<string, { head: string; body: string }> = {
  champions: {
    head: 'bg-league-champions border-league-champions-edge text-league-champions-foreground',
    body: 'bg-league-champions-tint',
  },
  admiral: {
    head: 'bg-league-admiral border-league-admiral-edge text-league-admiral-foreground',
    body: 'bg-league-admiral-tint',
  },
  dragon: {
    head: 'bg-league-dragon border-league-dragon-edge text-league-dragon-foreground',
    body: 'bg-league-dragon-tint',
  },
  galaxy: {
    head: 'bg-league-galaxy border-league-galaxy-edge text-league-galaxy-foreground',
    body: 'bg-league-galaxy-tint',
  },
  monarch: {
    head: 'bg-league-monarch border-league-monarch-edge text-league-monarch-foreground',
    body: 'bg-league-monarch-tint',
  },
};

export default function DesignHome() {
  return (
    <MockShell current='Home'>
      <div className='grid grid-cols-12 items-center gap-x-6 gap-y-10'>
        <div className='col-span-12 md:col-span-6'>
          <h1 className='text-3xl font-extrabold'>Week {CURRENT_WEEK}</h1>
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
        <GoalpostsAtDusk className='col-span-12 w-full md:col-span-6' />
      </div>

      <Section title='This week' className='mt-16'>
        <Panel>
          <table className='w-full text-left'>
            <thead className='text-sm text-muted-foreground'>
              <tr>
                <th className='pb-2 pr-6 font-normal'>Game</th>
                <th className='pb-2 pr-6 font-normal'>Due</th>
                <th className='pb-2 font-normal'>When</th>
              </tr>
            </thead>
            <tbody>
              {THIS_WEEK.map(row => (
                <tr key={row.game} className='border-t border-border'>
                  <td className='py-3 pr-6 font-semibold'>{row.game}</td>
                  <td className='py-3 pr-6'>{row.due}</td>
                  <td className='py-3'>{row.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </Section>

      <Section title='League leaders' className='mt-16'>
        <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5'>
          {LEAGUES.map(league => (
            <div key={league.key} className='flex flex-col'>
              <h3
                className={`border px-4 py-3 font-bold ${
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
            </div>
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
          <a
            href='/design'
            className='col-span-12 font-semibold text-brand underline underline-offset-4 md:col-span-2 md:text-right'
          >
            Listen
          </a>
        </Panel>
      </Section>
    </MockShell>
  );
}
