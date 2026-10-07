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
import LeadContext from '~/components/layout/profile/LeadContext';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import { Trophies } from '~/components/layout/profile/SeasonFinish';
import { CurrentTag } from '~/components/layout/profile/Tag';
import {
  ordinal,
  plural,
  pts,
  weekLabel,
} from '~/components/layout/profile/format';
import { TEXT } from '~/components/layout/profile/tones';
import { requireProfileMember } from '~/models/profile/access.server';
import { getBestBallProfile } from '~/models/profile/bestBall.server';
import type {
  BestBallCareer,
  BestBallSeason,
} from '~/models/profile/bestBallProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';
import { POSITION_TINT_COLORS } from '~/utils/constants';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireProfileMember(request, params.handle);

  return typedjson({ profile: await getBestBallProfile(userId) });
};

const finishLabel = (season: BestBallSeason) =>
  season.isComplete && season.place === 1 ? '🏆 1st' : ordinal(season.place);

export default function MemberBestBall() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='Best Ball'
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
  const best = career.bestFinish;

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 md:grid-cols-2'>
        <CareerCard
          title='Finishes'
          lead={
            career.titles > 0 ? (
              <>
                <Trophies titles={career.titles} />
                <LeadContext>{plural(career.titles, 'title')}</LeadContext>
              </>
            ) : best ? (
              <>
                {ordinal(best.place)}
                <LeadContext>{best.year}</LeadContext>
              </>
            ) : (
              '—'
            )
          }
        >
          <MiniStat
            label='Titles'
            value={career.titles}
            tone={career.titles > 0 ? TEXT.champion : undefined}
          />
          <MiniStat
            label='Average Finish'
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
          title='Average Week'
          lead={pts(career.averagePointsPerWeek, 1)}
        >
          <MiniStat label='Total Points' value={pts(career.totalPoints, 1)} />
          <MiniStat
            label='Best Week'
            value={pts(career.bestWeek?.points, 1)}
            tone='text-emerald-300'
            detail={career.bestWeek && weekLabel(career.bestWeek)}
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
          'Year',
          'Finish',
          'Points For',
          'Behind 1st',
          'Best Week',
          'Top Weeks',
          'Draft Slot',
        ]}
        primaryColumns={[1, 2]}
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
              {!season.isComplete && <CurrentTag />}
            </td>
            <td
              className={clsx(
                'px-2 py-2 font-semibold',
                season.isComplete && season.place === 1
                  ? TEXT.champion
                  : 'text-slate-200',
              )}
            >
              {finishLabel(season)}
              <span className='ml-1 text-xs font-normal text-slate-400'>
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
                  <span className='ml-1.5 text-xs text-slate-400'>
                    Week {season.bestWeek.week}
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
    >
      <div className='space-y-4'>
        {withPicks.map(season => (
          <div key={season.year}>
            <div className='mb-1 text-sm font-semibold text-white'>
              {season.year}
            </div>
            {/* The league's average roster as a fainter bar right under
                theirs, on the same scale, so a position they took more or
                less of shows as its boundary shifting. */}
            <div className='grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-xs text-slate-400'>
              <span>Drafted</span>
              <PositionBar counts={season.counts} />
              <span>League avg</span>
              <PositionBar
                counts={season.leagueAverage}
                size='small'
                label={`League average: ${(['QB', 'RB', 'WR', 'TE'] as const)
                  .map(group => `${season.leagueAverage[group]} ${group}`)
                  .join(', ')}`}
              />
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

/** "1.07" - the round, then the pick within it. */
const pickLabel = (pick: BestBallSeason['picks'][number], teamCount: number) =>
  `${pick.round}.${String(pick.pickNo - (pick.round - 1) * teamCount).padStart(
    2,
    '0',
  )}`;

function DraftPicks({ seasons }: { seasons: BestBallSeason[] }) {
  return (
    <ProfileSection title='Draft Picks'>
      <div className='space-y-4'>
        {seasons
          .filter(season => season.picks.length > 0)
          .map(season => (
            <div key={season.year}>
              <div className='mb-1 text-sm font-semibold text-white'>
                {season.year}
              </div>
              <ol className='m-0 grid list-none grid-cols-2 gap-1 p-0 text-xs sm:grid-cols-3 lg:grid-cols-6'>
                {season.picks.map(pick => (
                  <li
                    key={pick.pickNo}
                    title={`Round ${pick.round}, pick ${pick.pickNo} overall`}
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
                        {pickLabel(pick, season.teamCount)}
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
