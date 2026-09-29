import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import { ordinal, pts } from '~/libs/guillotine/display';
import { requireProfileAccess } from '~/models/profile/access.server';
import { getGuillotineProfile } from '~/models/profile/guillotine.server';
import type {
  GuillotineCareer,
  GuillotineClaim,
  GuillotineSeason,
  SurvivalWeek,
} from '~/models/profile/guillotineProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getGuillotineProfile(userId) });
};

type Players = Record<
  string,
  {
    name: string;
    firstName: string;
    lastName: string;
    position: string | null;
    nflTeam: string | null;
  }
>;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/** "2025 Guillotine for the People", without any emoji the league name has. */
const seasonLabel = (season: { year: number; leagueName: string }) =>
  `${season.year} ${season.leagueName.replace(/^\P{L}+/u, '').trim()}`;

const finishLabel = (season: GuillotineSeason) => {
  if (season.place === 1) return 'Champion';
  if (season.alive) return 'Alive';
  return season.place ? ordinal(season.place) : '—';
};

export default function MemberGuillotine() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='Guillotine'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Career career={profile.career} />
      <Survival seasons={profile.seasons} />
      <BySeason seasons={profile.seasons} players={profile.players} />
      {profile.topClaims.length > 0 && (
        <BiggestClaims claims={profile.topClaims} players={profile.players} />
      )}
      {profile.seasons.some(season => season.picks.length > 0) && (
        <DraftPicks seasons={profile.seasons} players={profile.players} />
      )}
    </div>
  );
}

function Career({ career }: { career: GuillotineCareer }) {
  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 md:grid-cols-3'>
        <CareerCard
          title='Survival'
          lead={pts(career.averageWeeksSurvived, 1)}
          leadNote='weeks lasted, on average'
        >
          <MiniStat
            label='Titles'
            value={career.titles}
            tone={career.titles > 0 ? 'text-amber-300' : undefined}
          />
          <MiniStat
            label='Podiums'
            value={career.podiums}
            hint='Finished in the top three'
          />
          <MiniStat
            label='Week 1 Chops'
            value={career.weekOneChops}
            tone={career.weekOneChops > 0 ? 'text-rose-300' : undefined}
          />
        </CareerCard>

        <CareerCard
          title='Scoring'
          lead={pts(career.averagePoints, 1)}
          leadNote='points a week'
        >
          <MiniStat
            label='Best Week'
            value={pts(career.bestWeek?.points, 1)}
            tone='text-emerald-300'
            detail={
              career.bestWeek &&
              `${career.bestWeek.year} wk ${career.bestWeek.week}`
            }
          />
          <MiniStat
            label='Closest Escape'
            value={
              career.closestEscape
                ? `+${pts(career.closestEscape.margin)}`
                : '—'
            }
            tone='text-amber-300'
            hint='The fewest points they ever survived the chop by'
            detail={
              career.closestEscape &&
              `${career.closestEscape.year} wk ${career.closestEscape.week}`
            }
          />
        </CareerCard>

        <CareerCard
          title='Waivers'
          lead={career.claimsWon}
          leadNote={
            career.bidWinRate === null
              ? 'claims won'
              : `claims won, ${Math.round(
                  career.bidWinRate * 100,
                )}% of bids placed`
          }
        >
          <MiniStat label='FAAB Spent' value={`$${career.faabSpent}`} />
          <MiniStat label='Bids Lost' value={career.bidsLost} />
        </CareerCard>
      </div>
    </ProfileSection>
  );
}

const survivalTone = (week: SurvivalWeek) => {
  switch (week.state) {
    case 'chopped':
      return 'bg-rose-600';
    case 'survived':
      if (week.margin !== null && week.margin < 5) return 'bg-amber-500';
      if (week.rank <= 3) return 'bg-emerald-500';
      return 'bg-slate-400';
    case 'gone':
      return 'bg-slate-800';
    default:
      return 'border border-dashed border-slate-600';
  }
};

const survivalTitle = (week: SurvivalWeek) => {
  if (!('points' in week)) {
    return week.state === 'gone'
      ? `Week ${week.week}: already chopped`
      : `Week ${week.week}: not played yet`;
  }
  const base = `Week ${week.week}: ${pts(week.points)} pts, ${ordinal(
    week.rank,
  )} of the week`;
  return week.state === 'chopped'
    ? `${base} - chopped`
    : week.margin !== null
    ? `${base}, ${pts(week.margin)} above the chop`
    : base;
};

/**
 * One strip per season, a square per week: how long they lasted, and how
 * close each week was.
 */
function Survival({ seasons }: { seasons: GuillotineSeason[] }) {
  return (
    <ProfileSection
      title='Survival'
      description='A square per week. Red is the chop, amber survived by under 5 points, green was a top-three week.'
    >
      <div className='space-y-2'>
        {seasons.map(season => (
          <div
            key={season.leagueId}
            className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 md:grid-cols-[14rem_1fr_6rem]'
          >
            <Link
              to={`/games/guillotine/${season.leagueId}`}
              className='truncate text-sm text-slate-200 no-underline hover:underline'
            >
              {seasonLabel(season)}
            </Link>
            <div
              className={clsx(
                'text-right text-sm font-semibold md:order-last',
                season.place === 1
                  ? 'text-amber-300'
                  : season.alive
                  ? 'text-emerald-300'
                  : 'text-slate-300',
              )}
            >
              {finishLabel(season)}
            </div>
            <div className='col-span-2 flex gap-0.5 md:col-span-1'>
              {season.weeks.map(week => (
                <div
                  key={week.week}
                  title={survivalTitle(week)}
                  className={clsx(
                    'h-4 min-w-0 flex-1 rounded-sm',
                    survivalTone(week),
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

function BySeason({
  seasons,
  players,
}: {
  seasons: GuillotineSeason[];
  players: Players;
}) {
  return (
    <ProfileSection title='By Season'>
      <ProfileTable
        headers={[
          'Season',
          'Finish',
          'Chopped',
          'Avg',
          'Best Week',
          'Closest Escape',
          'Claims',
          'FAAB',
          'Biggest Claim',
        ]}
        numericColumns={[3, 4, 5, 6, 7]}
      >
        {seasons.map(season => (
          <tr key={season.leagueId} className='border-b border-slate-700/60'>
            <td className='px-2 py-2'>
              <Link
                to={`/games/guillotine/${season.leagueId}`}
                className='text-white no-underline hover:underline'
              >
                {seasonLabel(season)}
              </Link>
            </td>
            <td
              className={clsx(
                'px-2 py-2 font-semibold',
                season.place === 1
                  ? 'text-amber-300'
                  : season.alive
                  ? 'text-emerald-300'
                  : 'text-slate-200',
              )}
            >
              {finishLabel(season)}
              {season.place && season.place > 1 && (
                <span className='ml-1 font-normal text-slate-500'>
                  of {season.teamCount}
                </span>
              )}
            </td>
            <td className='px-2 py-2'>
              {season.choppedWeek ? `Week ${season.choppedWeek}` : '—'}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {pts(season.averagePoints)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {season.bestWeek
                ? `${pts(season.bestWeek.points)} (Wk ${season.bestWeek.week})`
                : '—'}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {season.closestEscape
                ? `+${pts(season.closestEscape.margin)} (Wk ${
                    season.closestEscape.week
                  })`
                : '—'}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {season.claimsWon}
              <span className='ml-1 text-slate-500'>
                / {season.claimsWon + season.bidsLost}
              </span>
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              ${season.faabSpent}
            </td>
            <td className='px-2 py-2'>
              {season.biggestClaim ? (
                <>
                  {players[season.biggestClaim.sleeperId]?.name ??
                    season.biggestClaim.sleeperId}{' '}
                  <span className='text-slate-400'>
                    ${season.biggestClaim.bid}
                  </span>
                </>
              ) : (
                '—'
              )}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

function BiggestClaims({
  claims,
  players,
}: {
  claims: GuillotineClaim[];
  players: Players;
}) {
  return (
    <ProfileSection
      title='Biggest Claims'
      description='Their largest winning waiver bids, every season.'
    >
      <ol className='m-0 list-none space-y-1 p-0 text-sm'>
        {claims.map((claim, index) => {
          const player = players[claim.sleeperId];
          return (
            <li
              key={`${claim.year}-${claim.leagueName}-${claim.sleeperId}-${claim.week}`}
              className='flex flex-wrap justify-between gap-x-3 border-t border-slate-700 pt-1'
            >
              <span className='text-white'>
                <span className='mr-2 text-slate-500'>{index + 1}.</span>
                {player?.name ?? claim.sleeperId}
                {player && (
                  <span className='ml-1 text-xs text-slate-400'>
                    {[player.position, player.nflTeam]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </span>
              <span>
                <span className='font-semibold text-white'>${claim.bid}</span>{' '}
                <span className='text-slate-400'>
                  for week {claim.week}, {seasonLabel(claim)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </ProfileSection>
  );
}

function DraftPicks({
  seasons,
  players,
}: {
  seasons: GuillotineSeason[];
  players: Players;
}) {
  const drafted = seasons.filter(season => season.picks.length > 0);
  const [leagueId, setLeagueId] = useState(drafted[0].leagueId);
  const season =
    drafted.find(candidate => candidate.leagueId === leagueId) ?? drafted[0];

  return (
    <ProfileSection
      title='Draft Picks'
      action={
        drafted.length > 1 && (
          <div className='flex flex-wrap gap-1'>
            {drafted.map(candidate => (
              <button
                key={candidate.leagueId}
                type='button'
                onClick={() => setLeagueId(candidate.leagueId)}
                className={clsx(
                  'rounded px-2.5 py-1 text-sm',
                  candidate.leagueId === season.leagueId
                    ? 'bg-white font-medium text-slate-900'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                )}
              >
                {seasonLabel(candidate)}
              </button>
            ))}
          </div>
        )
      }
    >
      <ol className='m-0 grid list-none gap-1 p-0 text-sm sm:grid-cols-2'>
        {season.picks.map(pick => {
          const player = players[pick.sleeperId];
          return (
            <li
              key={pick.pickNo}
              className='flex items-baseline gap-2 rounded bg-slate-900/40 px-2 py-1'
            >
              <span className='w-20 shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-500'>
                R{pick.round} · {pick.pickNo}
              </span>
              <span className='text-white'>
                {player?.name ?? pick.sleeperId}
              </span>
              {player && (
                <span className='text-xs text-slate-400'>
                  {[player.position, player.nflTeam]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className='m-0 mt-2 text-xs text-slate-500'>
        {plural(season.picks.length, 'pick')} in {seasonLabel(season)}.
      </p>
    </ProfileSection>
  );
}
