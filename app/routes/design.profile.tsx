import { MockShell } from '~/components/mocks/MockShell';
import {
  leagueByKey,
  MEDAL_FILLS,
  medalFor,
  PROFILE,
} from '~/components/mocks/data';
import { Panel, Section, Square, SubNav } from '~/components/mocks/parts';
import { requireDesignMocks } from '~/services/design.server';

export const loader = () => requireDesignMocks();

const PROFILE_PAGES = ['Overview', 'Leagues', 'Games', 'History'].map(
  label => ({ label, to: '/design/profile' }),
);

/**
 * The Badge as the system draws it: a square block of the medal colour
 * holding the year, with its name set beneath in neutral type.
 */
function Honour({ medal, label, year }: (typeof PROFILE.honours)[number]) {
  return (
    <li>
      <span
        className={`flex size-24 items-end border p-3 text-lg font-extrabold ${MEDAL_FILLS[medal]}`}
      >
        {year}
      </span>
      <span className='mt-2 block text-sm'>{label}</span>
    </li>
  );
}

export default function DesignProfile() {
  const { teamsInLeague } = PROFILE;

  return (
    <MockShell current=''>
      <Panel className='grid grid-cols-12 gap-x-6 p-8'>
        <div className='col-span-12 md:col-span-8'>
          <h1 className='text-4xl font-extrabold tracking-tight'>
            {PROFILE.name}
          </h1>
          <p className='mt-2 text-muted-foreground'>@{PROFILE.handle}</p>
        </div>
        <dl className='col-span-12 mt-6 grid grid-cols-2 gap-x-6 md:col-span-4 md:mt-0'>
          <div>
            <dt className='text-sm text-muted-foreground'>Member since</dt>
            <dd className='mt-1 text-xl font-extrabold'>
              {PROFILE.memberSince}
            </dd>
          </div>
          <div>
            <dt className='text-sm text-muted-foreground'>Titles</dt>
            <dd className='mt-1 text-xl font-extrabold'>
              {PROFILE.honours.filter(h => h.medal === 'gold').length}
            </dd>
          </div>
        </dl>
      </Panel>

      <div className='mt-10'>
        <SubNav items={PROFILE_PAGES} current='Overview' />
      </div>

      <Section title='Honours' className='mt-10'>
        <ul className='grid grid-cols-3 gap-6 sm:grid-cols-6'>
          {PROFILE.honours.map(honour => (
            <Honour key={`${honour.label}-${honour.year}`} {...honour} />
          ))}
        </ul>
      </Section>

      <Section title='Seasons' className='mt-16'>
        <Panel className='overflow-x-auto'>
          <table className='w-full min-w-[32rem] text-left'>
            <thead className='text-sm text-muted-foreground'>
              <tr>
                <th className='pb-2 pr-6 font-normal'>Season</th>
                <th className='pb-2 pr-6 font-normal'>League</th>
                <th className='pb-2 pr-6 font-normal'>Finish</th>
                <th className='pb-2 pr-6 font-normal'>Record</th>
                <th className='pb-2 font-normal'>Points for</th>
              </tr>
            </thead>
            <tbody>
              {PROFILE.seasons.map(season => {
                const league = leagueByKey(season.league);
                const medal = medalFor(season.finish, teamsInLeague);
                return (
                  <tr key={season.year} className='border-t border-border'>
                    <td className='py-3 pr-6 font-semibold'>{season.year}</td>
                    <td className='py-3 pr-6'>
                      <span className='flex items-center gap-2'>
                        <Square fill={league.fill} />
                        {league.name}
                      </span>
                    </td>
                    <td className='py-3 pr-6'>
                      {season.finish === null ? (
                        <span className='text-muted-foreground'>
                          In progress
                        </span>
                      ) : (
                        <span className='flex items-center gap-2'>
                          {medal ? (
                            <Square fill={MEDAL_FILLS[medal]} />
                          ) : (
                            <span className='size-3' aria-hidden />
                          )}
                          {season.finish} of {teamsInLeague}
                        </span>
                      )}
                    </td>
                    <td className='py-3 pr-6'>{season.record}</td>
                    <td className='py-3'>{season.pointsFor.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </Section>
    </MockShell>
  );
}
