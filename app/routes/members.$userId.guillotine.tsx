import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import PercentileStrip from '~/components/layout/profile/PercentileStrip';
import PositionChip from '~/components/layout/profile/PositionChip';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import { Trophies } from '~/components/layout/profile/SeasonFinish';
import SegmentedControl from '~/components/layout/profile/SegmentedControl';
import ShowAllButton from '~/components/layout/profile/ShowAllButton';
import SplitBar from '~/components/layout/profile/SplitBar';
import {
  LegendItem,
  Swatch,
  WeekLegend,
} from '~/components/layout/profile/WeekGrid';
import YearFilter from '~/components/layout/profile/YearFilter';
import { ordinal, plural, pts } from '~/components/layout/profile/format';
import { TEXT } from '~/components/layout/profile/tones';
import { leagueKind } from '~/libs/guillotine/display';
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

/** "2025 Free" - the full names are long, and only the year and kind differ. */
const seasonLabel = (season: { year: number; leagueName: string }) =>
  `${season.year} ${leagueKind(season.leagueName)}`;

const finishLabel = (season: GuillotineSeason) => {
  if (season.place === 1) return '🏆 1st';
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
      <Career career={profile.career} seasons={profile.seasons} />
      <BySeason seasons={profile.seasons} players={profile.players} />
      <Survival seasons={profile.seasons} />
      {profile.claims.length > 0 && (
        <WaiverClaims claims={profile.claims} players={profile.players} />
      )}
      {profile.seasons.some(season => season.picks.length > 0) && (
        <DraftPicks seasons={profile.seasons} players={profile.players} />
      )}
    </div>
  );
}

function Career({
  career,
  seasons,
}: {
  career: GuillotineCareer;
  seasons: GuillotineSeason[];
}) {
  const best = career.bestFinish;
  // Every finished season on the same bottom-to-top scale as the weeks.
  const finishes = seasons.filter(
    (s): s is GuillotineSeason & { place: number } => s.place !== null,
  );
  const finishPercentile = (season: { place: number; teamCount: number }) =>
    season.teamCount > 1
      ? (season.teamCount - season.place) / (season.teamCount - 1)
      : 1;

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 md:grid-cols-3'>
        <CareerCard
          title='Finishes'
          lead={
            career.titles > 0 ? (
              <Trophies titles={career.titles} />
            ) : best ? (
              ordinal(best.place)
            ) : (
              '—'
            )
          }
          leadNote={
            !best
              ? 'no finishes yet'
              : best.place === 1
              ? `${plural(career.titles, 'title')}, latest ${seasonLabel(best)}`
              : `best finish, ${seasonLabel(best)}`
          }
          meter={
            <PercentileStrip
              values={finishes.map(finishPercentile)}
              average={null}
              label={(_, index) =>
                `${seasonLabel(finishes[index])}: ${ordinal(
                  finishes[index].place,
                )}`
              }
            />
          }
        >
          <MiniStat
            label='Longest Run'
            value={career.longestRun?.weeks ?? '—'}
            unit={career.longestRun ? 'weeks' : undefined}
            tone='text-emerald-300'
            hint='Most weeks played in a season, the chop week included'
          />
          <MiniStat
            label='Shortest Run'
            value={career.shortestRun?.weeks ?? '—'}
            unit={career.shortestRun ? 'weeks' : undefined}
            tone='text-rose-300'
            hint='Fewest weeks played in a season that is over for them'
          />
          <MiniStat
            label='Podiums'
            value={career.podiums}
            hint='Finished in the top three'
          />
        </CareerCard>

        <CareerCard
          title='Weekly Finish'
          lead={
            career.averagePercentile === null
              ? '—'
              : ordinal(Math.round(career.averagePercentile * 100))
          }
          leadNote='percentile in an average week, among the teams left'
          meter={
            <PercentileStrip
              values={career.weeklyPercentiles}
              average={career.averagePercentile}
            />
          }
        >
          <MiniStat
            label='Best Week'
            value={pts(career.bestWeek?.points, 1)}
            tone='text-emerald-300'
            detail={
              career.bestWeek &&
              `${seasonLabel(career.bestWeek)}, week ${career.bestWeek.week}`
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
              `${seasonLabel(career.closestEscape)}, week ${
                career.closestEscape.week
              }`
            }
          />
          <MiniStat
            label='Top Score'
            value={career.topScoreWeeks}
            unit='weeks'
            hint='Weeks they outscored everyone left'
          />
        </CareerCard>

        <CareerCard
          title='Waiver Bids Won'
          lead={career.claimsWon}
          leadNote={
            career.bidWinRate === null
              ? 'no bids placed'
              : `of ${career.claimsWon + career.bidsLost} placed, ${Math.round(
                  career.bidWinRate * 100,
                )}% of them`
          }
          meter={<SplitBar wins={career.claimsWon} losses={career.bidsLost} />}
        >
          <MiniStat label='Total FAAB Spent' value={`$${career.faabSpent}`} />
          <MiniStat
            label='Biggest Bid'
            value={career.biggestBid ? `$${career.biggestBid.bid}` : '—'}
          />
          <MiniStat
            label='Average Winning Bid'
            value={
              career.averageWinningBid === null
                ? '—'
                : `$${Math.round(career.averageWinningBid)}`
            }
          />
        </CareerCard>
      </div>
    </ProfileSection>
  );
}

/**
 * What each square means. They differ by lightness and by shape as well as by
 * hue - bright for a top-three week, mid grey for a safe one, an amber outline
 * for a narrow escape and a dark square marked ✕ for the chop - so they read
 * apart with red-green colour blindness too.
 */
const SURVIVAL = {
  top: { tone: 'bg-emerald-300 text-emerald-950', label: 'Top 3 that week' },
  survived: { tone: 'bg-slate-500 text-white', label: 'Survived' },
  close: {
    tone: 'bg-slate-500 text-white ring-2 ring-inset ring-amber-300',
    label: 'Survived by under 5',
  },
  chopped: { tone: 'bg-rose-800 text-rose-50', label: 'Chopped' },
  gone: { tone: 'bg-slate-800', label: 'Already out' },
  future: {
    tone: 'border border-dashed border-slate-500',
    label: 'Still to play',
  },
} as const;

const survivalKind = (week: SurvivalWeek): keyof typeof SURVIVAL => {
  switch (week.state) {
    case 'chopped':
      return 'chopped';
    case 'survived':
      if (week.margin !== null && week.margin < 5) return 'close';
      return week.rank <= 3 ? 'top' : 'survived';
    case 'gone':
      return 'gone';
    default:
      return 'future';
  }
};

const survivalTitle = (week: SurvivalWeek) => {
  if (!('points' in week)) {
    return week.state === 'gone'
      ? `Week ${week.week}: already chopped`
      : `Week ${week.week}: not played yet`;
  }
  const base = `Week ${week.week}: ${pts(week.points)} points, ${ordinal(
    week.rank,
  )} of the week`;
  return week.state === 'chopped'
    ? `${base}, chopped`
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
      title='Week by Week'
      description='A square for each week of each season: how long they lasted, and how close each week was.'
    >
      <div className='space-y-2'>
        {seasons.map(season => (
          <div
            key={season.leagueId}
            className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 md:grid-cols-[6.5rem_1fr_5rem]'
          >
            <Link
              to={`/games/guillotine/${season.leagueId}`}
              title={season.leagueName}
              className='truncate text-sm text-slate-200 no-underline hover:underline'
            >
              {seasonLabel(season)}
            </Link>
            <div
              className={clsx(
                'text-right text-sm font-semibold md:order-last',
                season.place === 1
                  ? TEXT.champion
                  : season.alive
                  ? TEXT.good
                  : 'text-slate-300',
              )}
            >
              {finishLabel(season)}
            </div>
            {/* A grid, not flex: flex sizes the dashed, bordered squares a
                pixel wider than the filled ones, so the columns drifted. */}
            <div
              className='col-span-2 grid gap-0.5 md:col-span-1'
              style={{
                gridTemplateColumns: `repeat(${season.weeks.length}, minmax(0, 1fr))`,
              }}
            >
              {season.weeks.map(week => {
                const kind = survivalKind(week);
                return (
                  <div
                    key={week.week}
                    title={survivalTitle(week)}
                    className={clsx(
                      'relative flex h-5 min-w-0 items-center justify-center overflow-hidden rounded-sm text-[10px] font-semibold leading-none tabular-nums md:h-6 lg:text-xs',
                      SURVIVAL[kind].tone,
                    )}
                  >
                    {/* The chop is marked at every size. Scores are too narrow
                        to read on a phone, and decimals wait until the squares
                        are wide; the hover text always has them. */}
                    {kind === 'chopped' ? (
                      <span aria-hidden='true'>✕</span>
                    ) : (
                      'points' in week && (
                        <span aria-hidden='true'>
                          <span className='hidden md:inline xl:hidden'>
                            {Math.round(week.points)}
                          </span>
                          <span className='hidden xl:inline'>
                            {pts(week.points)}
                          </span>
                        </span>
                      )
                    )}
                    <span className='sr-only'>{survivalTitle(week)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <WeekLegend>
        {(Object.keys(SURVIVAL) as (keyof typeof SURVIVAL)[]).map(kind => (
          <LegendItem
            key={kind}
            swatch={
              <Swatch tone={clsx(SURVIVAL[kind].tone, 'text-[0.6rem]')}>
                {kind === 'chopped' && '✕'}
              </Swatch>
            }
          >
            {SURVIVAL[kind].label}
          </LegendItem>
        ))}
      </WeekLegend>
    </ProfileSection>
  );
}

/** A week's number trailing its value, the way every profile table marks it. */
function WeekMark({
  value,
  week,
}: {
  value: string;
  week: number | undefined;
}) {
  return (
    <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
      {week === undefined ? (
        '—'
      ) : (
        <>
          {value}
          <span className='ml-1.5 text-xs text-slate-400'>Week {week}</span>
        </>
      )}
    </td>
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
          'Average',
          'Best Week',
          'Closest Escape',
          'Claims',
          'FAAB Spent',
          'FAAB Left',
          'Biggest Claim',
        ]}
        numericColumns={[3, 4, 5, 6, 7, 8]}
      >
        {seasons.map(season => (
          <tr key={season.leagueId} className='border-b border-slate-700/60'>
            <td className='px-2 py-2'>
              <Link
                to={`/games/guillotine/${season.leagueId}`}
                title={season.leagueName}
                className='whitespace-nowrap text-white no-underline hover:underline'
              >
                {seasonLabel(season)}
              </Link>
            </td>
            <td
              className={clsx(
                'px-2 py-2 font-semibold',
                season.place === 1
                  ? TEXT.champion
                  : season.alive
                  ? TEXT.good
                  : 'text-slate-200',
              )}
            >
              {finishLabel(season)}
            </td>
            <td className='px-2 py-2'>
              {season.choppedWeek ? `Week ${season.choppedWeek}` : '—'}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {pts(season.averagePoints)}
            </td>
            <WeekMark
              value={pts(season.bestWeek?.points)}
              week={season.bestWeek?.week}
            />
            <WeekMark
              value={`+${pts(season.closestEscape?.margin)}`}
              week={season.closestEscape?.week}
            />
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {season.claimsWon}
              <span className='ml-1 text-slate-400'>
                / {season.claimsWon + season.bidsLost}
              </span>
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              ${season.faabSpent}
            </td>
            <td
              className='px-2 py-2 text-right tabular-nums'
              title="Sleeper's balance, which can differ from the claims: commissioners zeroed chopped rosters by hand in the manual years"
            >
              ${season.faabLeft}
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              {season.biggestClaim ? (
                <>
                  {players[season.biggestClaim.sleeperId]?.name ??
                    season.biggestClaim.sleeperId}
                  <span className='ml-1.5 text-slate-400'>
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

/** Name, then NFL team, after a position chip - as the other tabs do it. */
function PlayerCell({
  sleeperId,
  players,
}: {
  sleeperId: string;
  players: Players;
}) {
  const player = players[sleeperId];
  return (
    <span className='inline-flex items-center gap-2'>
      <PositionChip position={player?.position ?? null} />
      <span className='font-medium text-slate-100'>
        {player?.name ?? sleeperId}
      </span>
      <span className='text-xs text-slate-400'>{player?.nflTeam ?? 'FA'}</span>
    </span>
  );
}

const CLAIMS_PREVIEW = 10;

type ClaimSort = 'bid' | 'week';

const CLAIM_SORTS: Record<
  ClaimSort,
  { label: string; compare: (a: GuillotineClaim, b: GuillotineClaim) => number }
> = {
  bid: {
    label: 'Bid',
    compare: (a, b) => b.bid - a.bid || b.year - a.year,
  },
  // Newest first, the way a log reads.
  week: {
    label: 'Time',
    compare: (a, b) =>
      b.year - a.year ||
      b.week - a.week ||
      a.leagueName.localeCompare(b.leagueName),
  },
};

function WaiverClaims({
  claims,
  players,
}: {
  claims: GuillotineClaim[];
  players: Players;
}) {
  const years = [...new Set(claims.map(claim => claim.year))].sort(
    (a, b) => b - a,
  );
  const [year, setYear] = useState<number | 'all'>(years[0] ?? 'all');
  const [sort, setSort] = useState<ClaimSort>('bid');
  const [showAll, setShowAll] = useState(false);

  const filtered = claims
    .filter(claim => year === 'all' || claim.year === year)
    .sort(CLAIM_SORTS[sort].compare);
  const visible = showAll ? filtered : filtered.slice(0, CLAIMS_PREVIEW);

  return (
    <ProfileSection
      title='Waiver Claims'
      action={
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-slate-400'>Sort by</span>
            <SegmentedControl
              label='Sort by'
              value={sort}
              onChange={setSort}
              options={(Object.keys(CLAIM_SORTS) as ClaimSort[]).map(
                option => ({ value: option, label: CLAIM_SORTS[option].label }),
              )}
            />
          </div>
          {years.length > 1 && (
            <YearFilter years={years} value={year} onChange={setYear} />
          )}
        </div>
      }
    >
      <ProfileTable
        headers={['Player', 'Bid', 'Season', 'Week']}
        numericColumns={[1, 3]}
      >
        {visible.map(claim => (
          <tr
            key={`${claim.year}-${claim.leagueName}-${claim.sleeperId}-${claim.week}`}
            className='border-b border-slate-700/60'
          >
            <td className='whitespace-nowrap px-2 py-2'>
              <PlayerCell sleeperId={claim.sleeperId} players={players} />
            </td>
            <td className='px-2 py-2 text-right font-semibold tabular-nums text-white'>
              ${claim.bid}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-slate-300'>
              {seasonLabel(claim)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-slate-300'>
              {claim.week}
            </td>
          </tr>
        ))}
      </ProfileTable>
      {filtered.length > CLAIMS_PREVIEW && (
        <ShowAllButton
          total={filtered.length}
          noun='claims'
          showAll={showAll}
          onToggle={() => setShowAll(value => !value)}
        />
      )}
    </ProfileSection>
  );
}

/** One draft at a time: pick the year, then the league when there were two. */
function DraftPicks({
  seasons,
  players,
}: {
  seasons: GuillotineSeason[];
  players: Players;
}) {
  const drafted = seasons.filter(season => season.picks.length > 0);
  const years = [...new Set(drafted.map(season => season.year))];
  const [year, setYear] = useState(drafted[0].year);
  const [kind, setKind] = useState(leagueKind(drafted[0].leagueName));
  const inYear = drafted.filter(season => season.year === year);
  // A year they only played one league in shows that one, whatever was picked.
  const season =
    inYear.find(candidate => leagueKind(candidate.leagueName) === kind) ??
    inYear[0];

  return (
    <ProfileSection
      title='Draft Picks'
      action={
        <div className='flex flex-wrap items-center gap-3'>
          {years.length > 1 && (
            <YearFilter
              years={years}
              value={year}
              onChange={value => value !== 'all' && setYear(value)}
              showAll={false}
            />
          )}
          {/* Only when they played both leagues that year. */}
          {inYear.length > 1 && (
            <SegmentedControl
              label='League'
              value={leagueKind(season.leagueName)}
              onChange={setKind}
              options={inYear.map(candidate => ({
                value: leagueKind(candidate.leagueName),
                label: leagueKind(candidate.leagueName),
              }))}
            />
          )}
        </div>
      }
    >
      <ProfileTable
        headers={['Round', 'Pick', 'Player', 'Teams']}
        numericColumns={[0, 1, 3]}
      >
        {season.picks.map(pick => (
          <tr key={pick.pickNo} className='border-b border-slate-700/60'>
            <td className='w-12 px-2 py-1.5 text-right tabular-nums text-slate-400'>
              {pick.round}
            </td>
            <td className='w-12 px-2 py-1.5 text-right tabular-nums text-slate-400'>
              {pick.pickNo}
            </td>
            <td className='whitespace-nowrap px-2 py-1.5'>
              <PlayerCell sleeperId={pick.sleeperId} players={players} />
            </td>
            <td
              title={`On ${plural(pick.teams, 'team')} over the season`}
              className={clsx(
                'w-16 px-2 py-1.5 text-right tabular-nums',
                pick.teams > 1 ? 'text-white' : 'text-slate-400',
              )}
            >
              {pick.teams}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}
