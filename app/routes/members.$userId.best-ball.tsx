import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import {
  PositionBar,
  positionColor,
} from '~/components/layout/best-ball/PositionCounts';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import { POSITION_GROUPS } from '~/libs/best-ball/views';
import { ordinal, pts } from '~/libs/guillotine/display';
import { requireProfileAccess } from '~/models/profile/access.server';
import { getBestBallProfile } from '~/models/profile/bestBall.server';
import type {
  BestBallCareer,
  BestBallSeason,
} from '~/models/profile/bestBallProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';
import { POSITION_TINT_COLORS } from '~/utils/constants';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getBestBallProfile(userId) });
};

const finishLabel = (season: BestBallSeason) =>
  season.isComplete && season.place === 1
    ? 'Champion'
    : `${ordinal(season.place)}${season.isComplete ? '' : ' (live)'}`;

export default function MemberBestBall() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='Autodraft Best Ball Mania'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Career career={profile.career} />
      <BySeason seasons={profile.seasons} />
      <PositionsDrafted seasons={profile.seasons} career={profile.career} />
      {profile.seasons.some(season => season.picks.length > 0) && (
        <DraftPicks seasons={profile.seasons} />
      )}
    </div>
  );
}

function Career({ career }: { career: BestBallCareer }) {
  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 md:grid-cols-2'>
        <CareerCard
          title='Finishes'
          lead={career.titles}
          leadNote={`title${career.titles === 1 ? '' : 's'} in ${
            career.seasons
          } season${career.seasons === 1 ? '' : 's'}`}
        >
          <MiniStat
            label='Best Finish'
            value={career.bestFinish ? ordinal(career.bestFinish.place) : '—'}
            tone={career.bestFinish?.place === 1 ? 'text-amber-300' : undefined}
            detail={career.bestFinish && `${career.bestFinish.year}`}
          />
          <MiniStat
            label='Avg Finish'
            value={pts(career.averageFinish, 1)}
            hint='Across finished seasons'
          />
          <MiniStat
            label='Podiums'
            value={career.podiums}
            hint='Finished in the top three'
          />
        </CareerCard>

        <CareerCard
          title='Scoring'
          lead={pts(career.averagePointsPerWeek, 1)}
          leadNote='best-ball points a week'
        >
          <MiniStat label='Total Points' value={pts(career.totalPoints, 1)} />
          <MiniStat
            label='Best Week'
            value={pts(career.bestWeek?.points, 1)}
            tone='text-emerald-300'
            detail={
              career.bestWeek &&
              `${career.bestWeek.year}, Wk ${career.bestWeek.week}`
            }
          />
        </CareerCard>
      </div>
    </ProfileSection>
  );
}

function BySeason({ seasons }: { seasons: BestBallSeason[] }) {
  return (
    <ProfileSection
      title='By Season'
      description='Ranked on points for through week 17.'
    >
      <ProfileTable
        headers={[
          'Season',
          'Finish',
          'Points For',
          'Back',
          'Best Week',
          'Top Wks',
          'Draft Slot',
        ]}
        numericColumns={[2, 3, 4, 5, 6]}
      >
        {seasons.map(season => (
          <tr key={season.year} className='border-b border-slate-700/60'>
            <td className='px-2 py-2'>
              <Link
                to={`/games/best-ball/${season.year}`}
                className='text-white no-underline hover:underline'
              >
                {season.year}
              </Link>
            </td>
            <td
              className={clsx(
                'px-2 py-2 font-semibold',
                season.isComplete && season.place === 1
                  ? 'text-amber-300'
                  : 'text-slate-200',
              )}
            >
              {finishLabel(season)}
              <span className='ml-1 text-xs font-normal text-slate-500'>
                of {season.teamCount}
              </span>
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-white'>
              {pts(season.pointsFor)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-slate-300'>
              {season.gap > 0 ? `-${pts(season.gap)}` : '—'}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {season.bestWeek ? (
                <>
                  {pts(season.bestWeek.points)}
                  <span className='ml-1.5 text-xs text-slate-500'>
                    Wk {season.bestWeek.week}
                  </span>
                </>
              ) : (
                '—'
              )}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {season.topScores || '—'}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {season.draftSlot ?? '—'}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

function PositionsDrafted({
  seasons,
  career,
}: {
  seasons: BestBallSeason[];
  career: BestBallCareer;
}) {
  const withPicks = seasons.filter(season => season.picks.length > 0);
  if (withPicks.length === 0) return null;

  return (
    <ProfileSection
      title='Positions Drafted'
      description="What the autodraft gave them each season, against the league's average roster."
      footnote={
        career.oddestDraft && withPicks.length > 1
          ? `Their oddest draft was ${
              career.oddestDraft.year
            }: ${POSITION_GROUPS.filter(g => career.oddestDraft!.counts[g] > 0)
              .map(g => `${career.oddestDraft!.counts[g]} ${g}`)
              .join(', ')}.`
          : undefined
      }
    >
      <div className='space-y-4'>
        {withPicks.map(season => (
          <div key={season.year}>
            <div className='mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm'>
              <span className='font-semibold text-white'>{season.year}</span>
              <span className='text-xs text-slate-400'>
                League average: QB {season.leagueAverage.QB} · RB{' '}
                {season.leagueAverage.RB} · WR {season.leagueAverage.WR} · TE{' '}
                {season.leagueAverage.TE}
              </span>
            </div>
            <PositionBar counts={season.counts} />
            <div className='mt-1 flex flex-wrap gap-3 text-xs'>
              {(['QB', 'RB', 'WR', 'TE'] as const).map(group => {
                const diff =
                  Math.round(
                    (season.counts[group] - season.leagueAverage[group]) * 10,
                  ) / 10;
                return (
                  <span key={group} className='text-slate-400'>
                    {group}{' '}
                    <span
                      className={clsx(
                        'tabular-nums',
                        season.counts[group] === 0
                          ? 'font-semibold text-rose-300'
                          : Math.abs(diff) >= 2
                          ? 'font-semibold text-amber-300'
                          : 'text-slate-300',
                      )}
                    >
                      {diff > 0 ? `+${diff}` : diff}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}

        {withPicks.length > 1 && (
          <div className='border-t border-slate-700 pt-4'>
            <div className='mb-1 text-sm font-semibold text-white'>
              All seasons
            </div>
            <PositionBar counts={career.positions} />
          </div>
        )}
      </div>
    </ProfileSection>
  );
}

function DraftPicks({ seasons }: { seasons: BestBallSeason[] }) {
  return (
    <ProfileSection
      title='Draft Picks'
      description='Every pick the CPU made for them, in order.'
    >
      <div className='space-y-4'>
        {seasons
          .filter(season => season.picks.length > 0)
          .map(season => (
            <div key={season.year}>
              <div className='mb-1 text-sm font-semibold text-white'>
                {season.year}
                {season.draftSlot && (
                  <span className='ml-2 text-xs font-normal text-slate-400'>
                    from slot {season.draftSlot}
                  </span>
                )}
              </div>
              <ol className='m-0 grid list-none grid-cols-2 gap-1 p-0 text-xs sm:grid-cols-3 lg:grid-cols-6'>
                {season.picks.map(pick => (
                  <li
                    key={pick.pickNo}
                    title={`Round ${pick.round}, pick ${pick.pickNo}`}
                    className={clsx(
                      'rounded px-1.5 py-1',
                      POSITION_TINT_COLORS[pick.position.toLowerCase()] ??
                        'bg-slate-700/60',
                    )}
                  >
                    <div className='truncate font-semibold text-white'>
                      {pick.playerName}
                    </div>
                    <div className='flex items-center gap-1 text-white/70'>
                      <span
                        className={clsx(
                          'rounded px-1 text-[0.65rem] font-semibold text-white',
                          positionColor(pick.position),
                        )}
                      >
                        {pick.position}
                      </span>
                      {pick.nflTeam ?? 'FA'}
                      <span className='ml-auto tabular-nums text-white/50'>
                        R{pick.round}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
      </div>
    </ProfileSection>
  );
}
