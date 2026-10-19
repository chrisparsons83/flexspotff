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
import { Trophies } from '~/components/layout/profile/SeasonFinish';
import { CurrentSeason } from '~/components/layout/profile/StatusText';
import {
  ordinal,
  plural,
  pts,
  weekLabel,
} from '~/components/layout/profile/format';
import { TEXT } from '~/components/layout/profile/tones';
import { positionTint } from '~/components/ui/fills';
import { Table } from '~/components/ui/table';
import { requireProfileMember } from '~/models/profile/access.server';
import { getBestBallProfile } from '~/models/profile/bestBall.server';
import type {
  BestBallCareer,
  BestBallSeason,
} from '~/models/profile/bestBallProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Autodraft BBM' };

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireProfileMember(request, params.handle);

  return typedjson({ profile: await getBestBallProfile(userId) });
};

const finishLabel = (season: BestBallSeason) =>
  season.isComplete && season.place === 1 ? 'Champion' : ordinal(season.place);

export default function MemberBestBall() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='Autodraft BBM'
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
              '–'
            )
          }
        >
          <MiniStat
            label='Titles'
            value={career.titles}
            tone={career.titles > 0 ? TEXT.champion : undefined}
          />
          <MiniStat
            label='Average finish'
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
          title='Average week'
          lead={pts(career.averagePointsPerWeek, 1)}
        >
          <MiniStat label='Total points' value={pts(career.totalPoints, 1)} />
          <MiniStat
            label='Best week'
            value={pts(career.bestWeek?.points, 1)}
            tone='text-positive'
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
      title='By season'
      description='Ranked on points for through week 17.'
    >
      <Table
        headers={[
          'Year',
          'Finish',
          'Points for',
          'Behind 1st',
          'Best week',
          'Top weeks',
          'Draft slot',
        ]}
        primaryColumns={[1, 2]}
        numericColumns={[2, 3, 4, 5, 6]}
      >
        {seasons.map(season => (
          <tr key={season.year} className='border-b border-border'>
            <td className='px-2 py-2'>
              <Link
                to={`/side-leagues/best-ball/${season.year}`}
                className='text-foreground no-underline hover:underline'
              >
                {season.year}
              </Link>
              {!season.isComplete && <CurrentSeason />}
            </td>
            <td
              className={clsx(
                'px-2 py-2 font-semibold',
                season.isComplete && season.place === 1
                  ? TEXT.champion
                  : 'text-foreground',
              )}
            >
              {finishLabel(season)}
              <span className='ml-1 text-sm font-normal text-muted-foreground'>
                of {season.teamCount}
              </span>
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-foreground'>
              {pts(season.pointsFor)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-foreground'>
              {season.gap > 0 ? `-${pts(season.gap)}` : '–'}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {season.bestWeek ? (
                <>
                  {pts(season.bestWeek.points)}
                  <span className='ml-1.5 text-sm text-muted-foreground'>
                    Week {season.bestWeek.week}
                  </span>
                </>
              ) : (
                '–'
              )}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {season.topScores || '–'}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {season.draftSlot ?? '–'}
            </td>
          </tr>
        ))}
      </Table>
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
      title='Positions drafted'
      description="What the autodraft gave them each season, against the league's average roster."
    >
      <div className='space-y-4'>
        {withPicks.map(season => (
          <div key={season.year}>
            <div className='mb-1 text-sm font-semibold text-foreground'>
              {season.year}
            </div>
            {/* The league's average roster as a fainter bar right under
                theirs, on the same scale, so a position they took more or
                less of shows as its boundary shifting. */}
            <div className='grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-sm text-muted-foreground'>
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
          <div className='border-t border-border pt-4'>
            <div className='mb-1 text-sm font-semibold text-foreground'>
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
    <ProfileSection title='Draft picks'>
      <div className='space-y-4'>
        {seasons
          .filter(season => season.picks.length > 0)
          .map(season => (
            <div key={season.year}>
              <div className='mb-1 text-sm font-semibold text-foreground'>
                {season.year}
              </div>
              <ol className='m-0 grid list-none grid-cols-2 gap-1 p-0 text-sm sm:grid-cols-3 lg:grid-cols-6'>
                {season.picks.map(pick => (
                  <li
                    key={pick.pickNo}
                    title={`Round ${pick.round}, pick ${pick.pickNo} overall`}
                    className={clsx('px-1.5 py-1', positionTint(pick.position))}
                  >
                    <div className='truncate font-semibold text-foreground'>
                      {pick.playerName}
                    </div>
                    <div className='flex items-center gap-1 text-foreground'>
                      <span
                        className={clsx(
                          'px-1 text-sm font-semibold text-foreground',
                          positionColor(pick.position),
                        )}
                      >
                        {pick.position}
                      </span>
                      {pick.nflTeam ?? 'FA'}
                      <span className='ml-auto tabular-nums text-foreground'>
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
