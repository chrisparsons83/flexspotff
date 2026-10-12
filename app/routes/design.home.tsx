import { MockShell } from '~/components/mocks/MockShell';
import {
  CURRENT_WEEK,
  LEAGUE_LEADERS,
  LEAGUES,
  PODCAST,
  THIS_WEEK,
} from '~/components/mocks/data';
import { Section } from '~/components/mocks/parts';
import { requireDesignMocks } from '~/services/design.server';

export const loader = () => requireDesignMocks();

export default function DesignHome() {
  return (
    <MockShell current='Home'>
      <div className='grid grid-cols-12 gap-x-6'>
        <div className='col-span-12 md:col-span-8'>
          <h1 className='text-3xl font-semibold'>Week {CURRENT_WEEK}</h1>
          <p className='mt-4 max-w-prose text-muted-foreground'>
            The Flex Spot runs five fantasy leagues and a set of weekly games
            for one Discord server. Survivor picks lock Sunday at 1:00 pm
            Eastern.
          </p>
        </div>
      </div>

      <Section title='This week' className='mt-16'>
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
      </Section>

      <Section title='League leaders' className='mt-16'>
        <div className='grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-5'>
          {LEAGUES.map(league => (
            <div key={league.key}>
              <div className={`h-2 border ${league.fill}`} aria-hidden />
              <h3 className='mt-3 font-semibold'>{league.name}</h3>
              <ol className='mt-3'>
                {LEAGUE_LEADERS[league.key].map((leader, i) => (
                  <li
                    key={leader.manager}
                    className='grid grid-cols-[1.5rem_1fr_auto] border-t border-border py-2 text-sm'
                  >
                    <span className='text-muted-foreground'>{i + 1}</span>
                    <span>{leader.manager}</span>
                    <span>{leader.record}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      <Section title='Podcast' className='mt-16'>
        <div className='grid grid-cols-12 gap-x-6'>
          <p className='col-span-12 font-semibold md:col-span-8'>
            {PODCAST.title}
          </p>
          <p className='col-span-6 text-muted-foreground md:col-span-2'>
            {PODCAST.date}
          </p>
          <p className='col-span-6 text-muted-foreground md:col-span-2 md:text-right'>
            {PODCAST.length}
          </p>
        </div>
      </Section>
    </MockShell>
  );
}
