import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import { CurrentTag } from '~/components/layout/profile/Tag';
import { ordinal, pct, plural } from '~/components/layout/profile/format';
import { TEXT } from '~/components/layout/profile/tones';
import PickChip from '~/components/layout/survivor/PickChip';
import { poolTitle } from '~/libs/survivor/views';
import { requireProfileAccess } from '~/models/profile/access.server';
import type { ProfileSummary } from '~/models/profile/summary.server';
import { getSurvivorProfile } from '~/models/profile/survivor.server';
import type {
  SurvivorCareer,
  SurvivorPoolResult,
  SurvivorTeamRow,
} from '~/models/profile/survivorProfile';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getSurvivorProfile(userId) });
};

const titleOf = (pool: { year: number; poolName: string }) =>
  poolTitle({ year: pool.year, name: pool.poolName });

function finishLabel(pool: SurvivorPoolResult) {
  if (pool.place === 1) return pool.winners > 1 ? '🏆 Co-winner' : '🏆 Winner';
  if (pool.place) return ordinal(pool.place);
  return pool.isAlive ? 'Alive' : 'Out';
}

function exitLabel(pool: SurvivorPoolResult) {
  if (pool.eliminatedWeek === null) return '—';
  return `Week ${pool.eliminatedWeek} · ${
    pool.missedPick ? 'no pick' : pool.outBy
  }`;
}

export default function MemberSurvivor() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='Survivor'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Career career={profile.career} />
      <ByPool pools={profile.pools} />
      <PickLog pools={profile.pools} />
      <Teams teams={profile.teams} />
    </div>
  );
}

function Career({ career }: { career: SurvivorCareer }) {
  const settled = career.pickWins + career.pickLosses;

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 md:grid-cols-2'>
        <CareerCard
          title='Pools'
          lead={career.wins}
          leadNote={`${career.wins === 1 ? 'win' : 'wins'} in ${plural(
            career.pools,
            'pool',
          )}${career.sharedWins > 0 ? `, ${career.sharedWins} shared` : ''}`}
        >
          <MiniStat
            label='Best Finish'
            value={career.bestPlace ? ordinal(career.bestPlace.place) : '—'}
            tone={career.bestPlace?.place === 1 ? TEXT.champion : undefined}
            detail={career.bestPlace && titleOf(career.bestPlace)}
          />
          <MiniStat
            label='Outlasted'
            value={pct(career.averageOutlasted)}
            hint='Share of the field they lasted longer than, on average'
          />
          <MiniStat
            label='Longest Run'
            value={career.longestRun ? career.longestRun.weeks : '—'}
            unit={career.longestRun ? 'wk' : undefined}
            detail={career.longestRun && titleOf(career.longestRun)}
          />
        </CareerCard>

        <CareerCard
          title='Picks'
          lead={settled > 0 ? pct(career.pickWins / settled) : '—'}
          leadNote={`of picks won, ${career.pickWins}–${career.pickLosses}`}
        >
          <MiniStat
            label='With the Crowd'
            value={pct(career.withCrowd)}
            hint="How often they took the week's most popular team"
          />
          <MiniStat
            label='Missed Picks'
            value={career.missedPicks}
            tone={career.missedPicks > 0 ? TEXT.bad : undefined}
            hint='Pools they went out of by not picking'
          />
          <MiniStat
            label='Nemesis'
            value={career.nemesis?.team ?? '—'}
            detail={
              career.nemesis && `knocked them out ${career.nemesis.times}×`
            }
          />
        </CareerCard>
      </div>
    </ProfileSection>
  );
}

function ByPool({ pools }: { pools: SurvivorPoolResult[] }) {
  return (
    <ProfileSection
      title='By Pool'
      description='Whoever lasts longest wins; entries that go out in the same week share a place.'
    >
      <ProfileTable
        headers={['Pool', 'Finish', 'Weeks Won', 'Went Out', 'Outlasted']}
        primaryColumns={[1, 2]}
        numericColumns={[2, 4]}
      >
        {pools.map(pool => (
          <tr key={pool.poolId} className='border-b border-slate-700/60'>
            <td className='px-2 py-2'>
              <Link
                to={`/games/survivor/${pool.poolId}`}
                className='text-white no-underline hover:underline'
              >
                {titleOf(pool)}
              </Link>
              {!pool.isComplete && <CurrentTag />}
            </td>
            <td
              className={clsx(
                'whitespace-nowrap px-2 py-2 font-semibold',
                pool.place === 1
                  ? TEXT.champion
                  : pool.isAlive && !pool.isComplete
                  ? TEXT.live
                  : 'text-slate-200',
              )}
            >
              {finishLabel(pool)}
              <span className='ml-1 text-xs font-normal text-slate-400'>
                of {pool.entryCount}
              </span>
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-white'>
              {pool.weeksWon}
            </td>
            <td
              className={clsx(
                'whitespace-nowrap px-2 py-2',
                pool.missedPick ? TEXT.bad : 'text-slate-300',
              )}
            >
              {exitLabel(pool)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-slate-300'>
              {pct(pool.outlasted)}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

function PickLog({ pools }: { pools: SurvivorPoolResult[] }) {
  return (
    <ProfileSection
      title='Pick Log'
      description='Every pick, week by week. ✓ won, ✗ lost, … not played yet.'
    >
      <div className='space-y-4'>
        {pools.map(pool => (
          <div key={pool.poolId}>
            <div className='mb-1 text-sm font-semibold text-white'>
              {titleOf(pool)}
            </div>
            <ol className='m-0 flex list-none flex-wrap gap-1 p-0'>
              {pool.weeks.map((week, index) =>
                pool.cells[index].kind === 'none' ? null : (
                  <li key={week} className='text-center'>
                    <div className='text-[0.65rem] tabular-nums text-slate-500'>
                      Wk {week}
                    </div>
                    <PickChip cell={pool.cells[index]} />
                  </li>
                ),
              )}
            </ol>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

function Teams({ teams }: { teams: SurvivorTeamRow[] }) {
  return (
    <ProfileSection
      title='Teams Picked'
      description='Every team they have trusted, most often first, with how it went.'
    >
      <ul className='m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4 lg:grid-cols-8'>
        {teams.map(team => (
          <li
            key={team.team}
            className='rounded bg-slate-900/60 px-2 py-1.5 text-center'
          >
            <div className='font-semibold text-white'>{team.team}</div>
            <div className='text-xs tabular-nums text-slate-400'>
              {plural(team.picks, 'pick')}
            </div>
            <div className='text-xs tabular-nums'>
              <span className={TEXT.good}>{team.wins}W</span>{' '}
              <span className={team.losses > 0 ? TEXT.bad : TEXT.neutral}>
                {team.losses}L
              </span>
            </div>
          </li>
        ))}
      </ul>
    </ProfileSection>
  );
}
