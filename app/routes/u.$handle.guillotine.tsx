import { Cross2Icon } from '@radix-ui/react-icons';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import LeadContext from '~/components/layout/profile/LeadContext';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import { Trophies } from '~/components/layout/profile/SeasonFinish';
import { ordinal, plural, pts } from '~/components/layout/profile/format';
import { TEXT } from '~/components/layout/profile/tones';
import { PercentileStrip, SplitBar } from '~/components/ui/bars';
import {
  SegmentedControl,
  YearFilter,
} from '~/components/ui/segmented-control';
import { ShowAllButton } from '~/components/ui/show-all-button';
import { PositionMark } from '~/components/ui/swatch';
import { Table } from '~/components/ui/table';
import { KeyList, LegendItem, LegendSwatch } from '~/components/ui/week-grid';
import { leagueKind } from '~/libs/guillotine/display';
import { requireProfileMember } from '~/models/profile/access.server';
import { getGuillotineProfile } from '~/models/profile/guillotine.server';
import type {
  GuillotineCareer,
  GuillotineClaim,
  GuillotineSeason,
  SurvivalWeek,
} from '~/models/profile/guillotineProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Guillotine' };

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireProfileMember(request, params.handle);

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
  if (season.place === 1) return 'Champion';
  if (season.alive) return 'Alive';
  return season.place ? ordinal(season.place) : '–';
};

export default function MemberGuillotine() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='guillotine'
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
  const finishes = seasons.filter(
    (s): s is GuillotineSeason & { place: number } => s.place !== null,
  );

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 md:grid-cols-3'>
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
                <LeadContext>{seasonLabel(best)}</LeadContext>
              </>
            ) : (
              '–'
            )
          }
          meter={<PlaceBar finishes={finishes} />}
        >
          <MiniStat
            label='Longest run'
            value={career.longestRun?.weeks ?? '–'}
            unit={career.longestRun ? 'weeks' : undefined}
            tone='text-positive'
            hint='Most weeks played in a season, the chop week included'
          />
          <MiniStat
            label='Shortest run'
            value={career.shortestRun?.weeks ?? '–'}
            unit={career.shortestRun ? 'weeks' : undefined}
            tone='text-negative'
            hint='Fewest weeks played in a season that is over for them'
          />
          <MiniStat
            label='Podiums'
            value={career.podiums}
            hint='Finished in the top three'
          />
        </CareerCard>

        <CareerCard
          title='Weekly finish'
          lead={
            career.averagePercentile === null ? (
              '–'
            ) : (
              <>
                {ordinal(Math.round(career.averagePercentile * 100))}
                <LeadContext>percentile</LeadContext>
              </>
            )
          }
          meter={
            <PercentileStrip
              values={career.weeklyPercentiles}
              average={career.averagePercentile}
            />
          }
        >
          <MiniStat
            label='Best week'
            value={pts(career.bestWeek?.points, 1)}
            tone='text-positive'
          />
          <MiniStat
            label='Closest escape'
            value={
              career.closestEscape
                ? `+${pts(career.closestEscape.margin)}`
                : '–'
            }
            tone='text-warning'
            hint='The fewest points they ever survived the chop by'
          />
          <MiniStat
            label='Top score'
            value={career.topScoreWeeks}
            unit='weeks'
            hint='Weeks they outscored everyone left'
          />
        </CareerCard>

        <CareerCard
          title='Waiver bids won'
          lead={
            <>
              {career.claimsWon}
              {career.bidWinRate !== null && (
                <LeadContext>{`${Math.round(
                  career.bidWinRate * 100,
                )}%`}</LeadContext>
              )}
            </>
          }
          meter={<SplitBar wins={career.claimsWon} losses={career.bidsLost} />}
        >
          <MiniStat label='Total FAAB Spent' value={`$${career.faabSpent}`} />
          <MiniStat
            label='Biggest bid'
            value={career.biggestBid ? `$${career.biggestBid.bid}` : '–'}
          />
          <MiniStat
            label='Average winning bid'
            value={
              career.averageWinningBid === null
                ? '–'
                : `$${Math.round(career.averageWinningBid)}`
            }
          />
        </CareerCard>
      </div>
    </ProfileSection>
  );
}

/**
 * A segment per place, last on the left and first on the right like the
 * weekly strip beside it, lit for each place they have finished in. A place
 * they have finished in more than once is brighter, and a title is gold.
 */
function PlaceBar({
  finishes,
}: {
  finishes: (GuillotineSeason & { place: number })[];
}) {
  const places =
    finishes.length > 0
      ? Math.max(...finishes.map(season => season.teamCount))
      : 18;

  return (
    <div aria-hidden='true' className='flex h-2 gap-0.5'>
      {Array.from({ length: places }, (_, index) => {
        const place = places - index;
        const here = finishes.filter(season => season.place === place);
        return (
          <div
            key={place}
            title={
              here.length > 0
                ? `${ordinal(place)}: ${here.map(seasonLabel).join(', ')}`
                : undefined
            }
            className={clsx(
              'flex-1',
              here.length === 0
                ? 'bg-secondary'
                : place === 1
                ? 'bg-medal-gold'
                : here.length > 1
                ? 'bg-info/20'
                : 'bg-info/40',
            )}
          />
        );
      })}
    </div>
  );
}

/**
 * What each square means. They differ by lightness and by shape as well as by
 * hue - bright for a top-three week, mid grey for a safe one, an amber outline
 * for a narrow escape and a dark square marked ✕ for the chop - so they read
 * apart with red-green colour blindness too.
 */
const SURVIVAL = {
  top: 'bg-positive/20 text-positive',
  survived: 'bg-secondary text-foreground',
  close: 'bg-secondary text-foreground ring-2 ring-inset ring-warning',
  chopped: 'bg-destructive/20 text-negative',
  gone: 'bg-card',
  future: 'border border-dashed border-border',
} as const;

const SURVIVAL_LABEL: Record<keyof typeof SURVIVAL, string> = {
  top: 'Top 3 that week',
  survived: 'Survived',
  close: 'Survived by under 5',
  chopped: 'Chopped',
  gone: 'Already out',
  future: 'Still to play',
};

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
      title='Week by week'
      info={
        <KeyList>
          {(Object.keys(SURVIVAL) as (keyof typeof SURVIVAL)[]).map(kind => (
            <LegendItem
              key={kind}
              swatch={
                <LegendSwatch tone={clsx(SURVIVAL[kind], 'text-sm')}>
                  {kind === 'chopped' && <Cross2Icon aria-hidden />}
                </LegendSwatch>
              }
            >
              {SURVIVAL_LABEL[kind]}
            </LegendItem>
          ))}
        </KeyList>
      }
    >
      <div className='space-y-2'>
        {seasons.map(season => (
          <div
            key={season.leagueId}
            className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 md:grid-cols-[6.5rem_1fr_5rem]'
          >
            <Link
              to={`/side-leagues/guillotine/${season.leagueId}`}
              title={season.leagueName}
              className='truncate text-sm text-foreground no-underline hover:underline'
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
                  : 'text-foreground',
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
                      'relative flex h-5 min-w-0 items-center justify-center overflow-hidden text-[10px] font-semibold leading-none tabular-nums md:h-6 lg:text-sm',
                      SURVIVAL[kind],
                    )}
                  >
                    {/* The chop is marked at every size. Scores are too narrow
                        to read on a phone, and decimals wait until the squares
                        are wide; the hover text always has them. */}
                    {kind === 'chopped' ? (
                      <Cross2Icon aria-hidden='true' className='mx-auto' />
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
        '–'
      ) : (
        <>
          {value}
          <span className='ml-1.5 text-sm text-muted-foreground'>
            Week {week}
          </span>
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
    <ProfileSection title='By season'>
      <Table
        headers={[
          'Season',
          'Finish',
          'Chopped',
          'Average',
          'Best week',
          'Closest escape',
          'Claims',
          'FAAB Spent',
          'FAAB Left',
          'Biggest claim',
        ]}
        primaryColumns={[1, 2]}
        numericColumns={[3, 4, 5, 6, 7, 8]}
      >
        {seasons.map(season => (
          <tr key={season.leagueId} className='border-b border-border'>
            <td className='px-2 py-2'>
              <Link
                to={`/side-leagues/guillotine/${season.leagueId}`}
                title={season.leagueName}
                className='whitespace-nowrap text-foreground no-underline hover:underline'
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
                  : 'text-foreground',
              )}
            >
              {finishLabel(season)}
            </td>
            <td className='px-2 py-2'>
              {season.choppedWeek ? `Week ${season.choppedWeek}` : '–'}
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
              <span className='ml-1 text-muted-foreground'>
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
                  <span className='ml-1.5 text-muted-foreground'>
                    ${season.biggestClaim.bid}
                  </span>
                </>
              ) : (
                '–'
              )}
            </td>
          </tr>
        ))}
      </Table>
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
    <span className='inline-flex flex-wrap items-center gap-x-2 gap-y-0.5'>
      <PositionMark position={player?.position ?? null} />
      <span className='font-medium text-foreground'>
        {player?.name ?? sleeperId}
      </span>
      <span className='text-sm text-muted-foreground'>
        {player?.nflTeam ?? 'FA'}
      </span>
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
      title='Waiver claims'
      action={
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2'>
            <span className='text-sm text-muted-foreground'>Sort by</span>
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
      <Table
        headers={['Player', 'Bid', 'Season', 'Week']}
        primaryColumns={[1]}
        numericColumns={[1, 3]}
      >
        {visible.map(claim => (
          <tr
            key={`${claim.year}-${claim.leagueName}-${claim.sleeperId}-${claim.week}`}
            className='border-b border-border'
          >
            <td className='px-2 py-2 sm:whitespace-nowrap'>
              <PlayerCell sleeperId={claim.sleeperId} players={players} />
            </td>
            <td className='px-2 py-2 text-right font-semibold tabular-nums text-foreground'>
              ${claim.bid}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-foreground'>
              {seasonLabel(claim)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-foreground'>
              {claim.week}
            </td>
          </tr>
        ))}
      </Table>
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
      title='Draft picks'
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
      <Table
        headers={['Round', 'Pick', 'Player', 'Teams']}
        primaryColumns={[2, 3]}
        numericColumns={[0, 1, 3]}
      >
        {season.picks.map(pick => (
          <tr key={pick.pickNo} className='border-b border-border'>
            <td className='w-12 px-2 py-1.5 text-right tabular-nums text-muted-foreground'>
              {pick.round}
            </td>
            <td className='w-12 px-2 py-1.5 text-right tabular-nums text-muted-foreground'>
              {pick.pickNo}
            </td>
            <td className='px-2 py-1.5 sm:whitespace-nowrap'>
              <PlayerCell sleeperId={pick.sleeperId} players={players} />
            </td>
            <td
              title={`On ${plural(pick.teams, 'team')} over the season`}
              className={clsx(
                'w-16 px-2 py-1.5 text-right tabular-nums',
                pick.teams > 1 ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {pick.teams}
            </td>
          </tr>
        ))}
      </Table>
    </ProfileSection>
  );
}
