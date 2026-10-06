import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { KeyedBar } from '~/components/layout/profile/BarKey';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import FinishMeter from '~/components/layout/profile/FinishMeter';
import LabelledRange from '~/components/layout/profile/LabelledRange';
import LeadContext from '~/components/layout/profile/LeadContext';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import SeasonFinish, {
  Trophies,
} from '~/components/layout/profile/SeasonFinish';
import SegmentedControl from '~/components/layout/profile/SegmentedControl';
import ShowAllButton from '~/components/layout/profile/ShowAllButton';
import Tag, { CurrentTag } from '~/components/layout/profile/Tag';
import WeekGrid, {
  LegendItem,
  ScaleKey,
  Swatch,
  WeekLegend,
  WonKey,
  rankTone,
} from '~/components/layout/profile/WeekGrid';
import type { WeekGridCell } from '~/components/layout/profile/WeekGrid';
import WinLoss from '~/components/layout/profile/WinLoss';
import YearFilter from '~/components/layout/profile/YearFilter';
import {
  CHART,
  ChartKey,
  ChartKeys,
  FieldBandKeys,
  useChartWidth,
  weekLabelStep,
} from '~/components/layout/profile/chart';
import {
  line,
  ordinal,
  pct as pctBy,
  plural,
  signed,
  weekLabel,
} from '~/components/layout/profile/format';
import type { TagTone } from '~/components/layout/profile/tones';
import { BAR, signedTone, TEXT } from '~/components/layout/profile/tones';
import { requireProfileAccess } from '~/models/profile/access.server';
import { getSpreadPoolProfile } from '~/models/profile/spreadPool.server';
import {
  MAX_BET,
  STARTING_BANK,
  type PoolBet,
  type PoolCareer,
  type PoolSeason,
  type PoolSplits,
  type PoolTeamRow,
  type PoolWeek,
  type Record3,
  type SplitBucket,
  settledRank,
  winRate,
} from '~/models/profile/spreadPoolProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getSpreadPoolProfile(userId) });
};

/** Win rates to a tenth of a percent, since a season's bets run to hundreds. */
const pct = (value: number | null) => pctBy(value, 1);

const record = ({ wins, losses, pushes }: Record3) =>
  `${wins}-${losses}${pushes ? `-${pushes}` : ''}`;

export default function MemberSpreadPool() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='the Spread Pool'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Career career={profile.career} seasons={profile.seasons} />
      <BySeason seasons={profile.seasons} />
      <Bankroll seasons={profile.seasons} />
      <WeekByWeek seasons={profile.seasons} />
      <FavoritesAndUnderdogs splits={profile.splits} />
      <Tendencies splits={profile.splits} />
      <Teams rows={profile.teams} names={profile.teamNames} />
      <BetLog seasons={profile.seasons} />
    </div>
  );
}

function Career({
  career,
  seasons,
}: {
  career: PoolCareer;
  seasons: PoolSeason[];
}) {
  const finalBanks = seasons
    .filter(season => !season.inProgress)
    .map(season => season.bank);
  const averageBank =
    finalBanks.length > 0
      ? finalBanks.reduce((total, bank) => total + bank, 0) / finalBanks.length
      : null;

  const bestSeason = seasons
    .map(season => ({ year: season.year, rate: winRate(season.record) }))
    .filter(
      (season): season is { year: number; rate: number } =>
        season.rate !== null,
    )
    .reduce<{ year: number; rate: number } | null>(
      (best, season) => (!best || season.rate > best.rate ? season : best),
      null,
    );

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <CareerCard
          title='Bankroll'
          lead={
            <>
              <span className={signedTone(career.net)}>
                {signed(career.net)}
              </span>
              {career.roe !== null && (
                <LeadContext>
                  <span
                    className={clsx('font-semibold', signedTone(career.roe))}
                  >
                    {signed(career.roe * 100, 1)}%
                  </span>{' '}
                  return
                </LeadContext>
              )}
            </>
          }
          meter={
            // One finished season would put the same bank at both ends, so
            // it keeps the bar's space instead, to stay level with the rest.
            finalBanks.length > 1 &&
            career.bestBank &&
            career.worstBank &&
            averageBank !== null ? (
              <LabelledRange
                low={career.worstBank.bank}
                high={career.bestBank.bank}
                mark={averageBank}
                lowLabel={String(career.worstBank.year)}
                highLabel={String(career.bestBank.year)}
              />
            ) : (
              <div aria-hidden='true' className='h-8' />
            )
          }
        >
          <MiniStat
            label='Total Bet'
            value={career.wagered.toLocaleString()}
            hint='Every point bet, won or lost'
          />
          <MiniStat
            label='Average Bet'
            value={
              career.averageBet === null ? '—' : career.averageBet.toFixed(1)
            }
            detail={
              career.bets > 0
                ? `${Math.round((career.maxBets / career.bets) * 100)}% max`
                : null
            }
            hint={`Of the ${MAX_BET} a game allowed, and how often they bet all of it`}
          />
        </CareerCard>

        <CareerCard
          title='Bets Won'
          lead={pct(career.winRate)}
          meter={
            <SplitKey
              record={career.record}
              labels={['won', 'pushed', 'lost']}
            />
          }
        >
          <MiniStat
            label='Bets'
            value={career.bets.toLocaleString()}
            hint='Every bet placed, pushes included'
          />
          <MiniStat
            label='Best Season'
            value={bestSeason ? pct(bestSeason.rate) : '—'}
            detail={bestSeason ? String(bestSeason.year) : null}
            hint='Their best win rate in a season'
          />
        </CareerCard>

        <WeeksCard career={career} />

        <FinishesCard career={career} seasons={seasons} />
      </div>
    </ProfileSection>
  );
}

/** A record as a split bar, with each part's count under it. */
function SplitKey({
  record,
  labels,
}: {
  record: Record3;
  labels: [win: string, push: string, loss: string];
}) {
  return (
    <KeyedBar
      entries={[
        { count: record.wins, label: labels[0], tone: BAR.win },
        { count: record.pushes, label: labels[1], tone: BAR.tie },
        { count: record.losses, label: labels[2], tone: BAR.loss },
      ]}
    />
  );
}

/** How their weeks have gone: up, even and down, and the extremes. */
function WeeksCard({ career }: { career: PoolCareer }) {
  const { weeks, bestWeek, worstWeek } = career;

  return (
    <CareerCard
      title='Up Weeks'
      lead={
        <>
          {career.weeksPlayed > 0
            ? `${Math.round((weeks.wins / career.weeksPlayed) * 100)}%`
            : '—'}
        </>
      }
      meter={<SplitKey record={weeks} labels={['up', 'even', 'down']} />}
    >
      <MiniStat
        label='Won'
        value={career.weeksWon}
        hint='Weeks with the top net of everyone who played'
        tone={career.weeksWon > 0 ? TEXT.champion : undefined}
      />
      <MiniStat
        label='Best'
        value={bestWeek ? signed(bestWeek.net) : '—'}
        detail={bestWeek && weekLabel(bestWeek)}
        tone={bestWeek ? signedTone(bestWeek.net) : undefined}
      />
      <MiniStat
        label='Worst'
        value={worstWeek ? signed(worstWeek.net) : '—'}
        detail={worstWeek && weekLabel(worstWeek)}
        tone={worstWeek ? signedTone(worstWeek.net) : undefined}
      />
      <MiniStat
        label='Missed'
        value={career.missedWeeks}
        hint={
          career.missedWeeks > 0
            ? `Weeks with no bets, which cost ${signed(career.missedCost)}`
            : 'Weeks with no bets'
        }
        tone={career.missedWeeks > 0 ? TEXT.bad : undefined}
      />
    </CareerCard>
  );
}

/** How their seasons have ended, as counts rather than a list of years. */
function FinishesCard({
  career,
  seasons,
}: {
  career: PoolCareer;
  seasons: PoolSeason[];
}) {
  const finished = seasons.flatMap(season => {
    const rank = season.inProgress ? null : settledRank(season);
    return rank === null ? [] : [rank];
  });

  // A member still in their first season has no finishes yet; show where
  // they stand instead.
  if (finished.length === 0) {
    return career.standing ? (
      <CareerCard
        title='Standing'
        lead={
          <>
            {ordinal(career.standing.rank)}
            <LeadContext>
              of {career.standing.fieldSize} in {career.standing.year}
            </LeadContext>
          </>
        }
      >
        <MiniStat label='Weeks Played' value={career.weeksPlayed} />
      </CareerCard>
    ) : null;
  }

  return (
    <CareerCard
      title='Finishes'
      lead={
        career.titles > 0 ? (
          <>
            <Trophies titles={career.titles} />
            <LeadContext>{plural(career.titles, 'title')}</LeadContext>
          </>
        ) : (
          <>
            {ordinal(career.bestFinish!.rank)}
            <LeadContext>{career.bestFinish!.year}</LeadContext>
          </>
        )
      }
      meter={<FinishMeter ranks={finished} />}
    >
      <MiniStat
        label='Average Finish'
        value={ordinal(Math.round(career.averageFinish!))}
        hint={`${career.averageFinish!.toFixed(1)} across ${plural(
          finished.length,
          'finished season',
        )}`}
      />
      <MiniStat
        label='Up Seasons'
        value={`${career.profitableSeasons}/${career.completedSeasons}`}
        hint={`Finished seasons that ended above the ${STARTING_BANK} they started with`}
      />
    </CareerCard>
  );
}

function BySeason({ seasons }: { seasons: PoolSeason[] }) {
  return (
    <ProfileSection
      title='By Season'
      footnote='ROE is return on everything bet: the net as a share of the total bet.'
    >
      <ProfileTable
        headers={[
          'Year',
          'Finish',
          'Bank',
          'Record',
          'Win %',
          'ROE',
          'Best Week',
          'Worst Week',
          'Missed',
        ]}
        numericColumns={[2, 3, 4, 5, 6, 7, 8]}
      >
        {seasons.map(season => (
          <tr key={season.year} className='border-b border-slate-700/70'>
            <td className='px-2 py-2'>
              <Link to={`/games/spread-pool/standings/${season.year}`}>
                {season.year}
              </Link>
              {season.inProgress && <CurrentTag />}
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              <SeasonFinish finish={season.finish} champion={season.champion} />
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              <span className='font-medium'>{season.bank}</span>
              <span className={clsx('ml-1.5 text-xs', signedTone(season.net))}>
                {signed(season.net)}
              </span>
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {record(season.record)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {pct(
                season.record.wins + season.record.losses > 0
                  ? season.record.wins /
                      (season.record.wins + season.record.losses)
                  : null,
              )}
            </td>
            <td
              className={clsx(
                'px-2 py-2 text-right tabular-nums',
                signedTone(season.roe),
              )}
            >
              {season.roe === null ? '—' : `${signed(season.roe * 100, 1)}%`}
            </td>
            <WeekCell week={season.bestWeek} />
            <WeekCell week={season.worstWeek} />
            <td
              className={clsx(
                'px-2 py-2 text-right tabular-nums',
                season.missedWeeks > 0 ? TEXT.bad : 'text-slate-400',
              )}
            >
              {season.missedWeeks}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

function WeekCell({ week }: { week: PoolWeek | null }) {
  return (
    <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
      {week ? (
        <>
          <span className={signedTone(week.net)}>{signed(week.net)}</span>
          <span className='ml-1.5 text-xs text-slate-400'>
            Week {week.week}
          </span>
        </>
      ) : (
        '—'
      )}
    </td>
  );
}

const CHART_LEFT = 44;

/**
 * The member's bank through a season, over the field's: the middle half of
 * banks as a band, the whole spread fainter behind it, and the median as a
 * dashed line. Missed weeks are hollow red points, since a penalty is the
 * only way to lose without betting.
 */
function Bankroll({ seasons }: { seasons: PoolSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);
  const season = seasons.find(entry => entry.year === year) ?? seasons[0];
  const [chartRef, width] = useChartWidth<HTMLDivElement>();

  const points = [
    { week: 0, bank: STARTING_BANK, missed: false, net: 0, label: 'Start' },
    ...season.weeks.map(week => ({
      week: week.week,
      bank: week.bank,
      missed: week.missed,
      net: week.net,
      label: `Week ${week.week}`,
    })),
  ];
  const field = [
    {
      week: 0,
      low: STARTING_BANK,
      high: STARTING_BANK,
      q1: STARTING_BANK,
      q3: STARTING_BANK,
      median: STARTING_BANK,
    },
    ...season.field,
  ];

  const lastWeek = Math.max(
    ...points.map(point => point.week),
    ...field.map(point => point.week),
    1,
  );
  const values = [
    ...points.map(point => point.bank),
    ...field.flatMap(point => [point.low, point.high]),
  ];
  // Rounded out to the next 250 so the gridlines land on round numbers.
  const floor = Math.floor(Math.min(...values) / 250) * 250;
  const ceiling = Math.ceil(Math.max(...values) / 250) * 250;

  const plotWidth = width - CHART_LEFT - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const x = (week: number) => CHART_LEFT + (week / lastWeek) * plotWidth;
  const y = (bank: number) =>
    CHART.top + (1 - (bank - floor) / (ceiling - floor || 1)) * plotHeight;

  const area = (upper: (p: (typeof field)[0]) => number, lower: typeof upper) =>
    [
      ...field.map(point => `${x(point.week)},${y(upper(point))}`),
      ...[...field]
        .reverse()
        .map(point => `${x(point.week)},${y(lower(point))}`),
    ].join(' ');

  const gridlines = Array.from(
    { length: Math.round((ceiling - floor) / 250) + 1 },
    (_, index) => floor + index * 250,
  ).filter((_, index, all) => all.length <= 8 || index % 2 === 0);

  const final = points[points.length - 1];
  const weekStep = weekLabelStep(plotWidth, lastWeek);

  return (
    <ProfileSection
      title='Bankroll'
      description={
        season.inProgress
          ? `${season.year}: ${final.bank}${
              season.finish
                ? `, ${ordinal(season.finish.rank)} of ${
                    season.finish.fieldSize
                  }`
                : ''
            }`
          : `${season.year}: finished with ${final.bank}${
              season.finish
                ? `, ${ordinal(season.finish.rank)} of ${
                    season.finish.fieldSize
                  }`
                : ''
            }`
      }
      action={
        <YearFilter
          years={years}
          value={season.year}
          onChange={setYear}
          showAll={false}
        />
      }
      footnote={
        <ChartKeys>
          <ChartKey>
            <span className='inline-block h-0.5 w-4 rounded bg-sky-400' />
            Bank
          </ChartKey>
          <FieldBandKeys rangeLabel='Lowest to highest' />
          <ChartKey>
            <span className='inline-block h-2 w-2 rounded-full border-2 border-rose-400' />
            Missed week
          </ChartKey>
        </ChartKeys>
      }
    >
      <div ref={chartRef}>
        <svg
          width={width}
          height={CHART.height}
          viewBox={`0 0 ${width} ${CHART.height}`}
          className='block'
          role='img'
          aria-label={`Bank through ${season.year}, week by week, against the rest of the field`}
        >
          {gridlines.map(value => (
            <g key={value}>
              <line
                x1={CHART_LEFT}
                x2={width - CHART.right}
                y1={y(value)}
                y2={y(value)}
                className={
                  value === STARTING_BANK
                    ? 'stroke-slate-400'
                    : 'stroke-slate-700'
                }
                strokeWidth={1}
              />
              <text
                x={CHART_LEFT - 6}
                y={y(value)}
                textAnchor='end'
                dominantBaseline='middle'
                className='fill-slate-500 text-[11px] tabular-nums'
              >
                {value}
              </text>
            </g>
          ))}
          {Array.from({ length: lastWeek }, (_, index) => index + 1)
            .filter(week => (week - 1) % weekStep === 0)
            .map(week => (
              <text
                key={week}
                x={x(week)}
                y={CHART.height - 8}
                textAnchor='middle'
                className='fill-slate-500 text-[11px] tabular-nums'
              >
                {week}
              </text>
            ))}

          <polygon
            points={area(
              point => point.high,
              point => point.low,
            )}
            className='fill-slate-400/10'
          />
          <polygon
            points={area(
              point => point.q3,
              point => point.q1,
            )}
            className='fill-slate-400/25'
          />
          <polyline
            points={field
              .map(point => `${x(point.week)},${y(point.median)}`)
              .join(' ')}
            fill='none'
            className='stroke-slate-300'
            strokeWidth={1.25}
            strokeDasharray='4 4'
          />
          <polyline
            points={points
              .map(point => `${x(point.week)},${y(point.bank)}`)
              .join(' ')}
            fill='none'
            className='stroke-sky-400'
            strokeWidth={2.5}
            strokeLinejoin='round'
          />
          {points.map(point => (
            <circle
              key={point.week}
              cx={x(point.week)}
              cy={y(point.bank)}
              r={point.missed ? 4.5 : 3.5}
              className={
                point.missed
                  ? 'fill-slate-900 stroke-rose-400'
                  : 'fill-sky-400 stroke-slate-900'
              }
              strokeWidth={2}
            >
              {/* One string: a <title> with several children breaks hydration. */}
              <title>
                {`${point.label}: ${point.bank}${
                  point.week > 0
                    ? ` (${signed(point.net)}${
                        point.missed ? ', missed week' : ''
                      })`
                    : ''
                }`}
              </title>
            </circle>
          ))}
        </svg>
      </div>
    </ProfileSection>
  );
}

const MISSED_TONE =
  'border border-dashed border-rose-400/70 bg-transparent text-rose-300';

const describeBet = (bet: PoolBet) =>
  `${
    bet.result === 'win' ? 'Won' : bet.result === 'loss' ? 'Lost' : 'Pushed'
  } ${bet.amount} on ${bet.team} ${line(bet.spread)} ${
    bet.isHome ? 'vs' : '@'
  } ${bet.opponent}`;

const describeWeek = (week: PoolWeek) =>
  week.missed
    ? `${weekLabel(week)}: missed, ${signed(week.net)}. Bank ${week.bank}.`
    : `${weekLabel(week)}: ${signed(week.net)}, ${ordinal(week.rank)} of ${
        week.fieldSize
      }${week.rank === 1 ? ', won the week' : ''}. Bank ${
        week.bank
      }.\n${week.bets.map(describeBet).join('\n')}`;

/** Every season as a strip of weeks, so a career's hot and cold runs show. */
function WeekByWeek({ seasons }: { seasons: PoolSeason[] }) {
  const lastWeek = Math.max(
    ...seasons.flatMap(season => season.weeks.map(week => week.week)),
  );
  const anyMissed = seasons.some(season => season.missedWeeks > 0);

  return (
    <ProfileSection
      title='Week by Week'
      description='Each week’s net, shaded by where it ranked among everyone who played it.'
    >
      <WeekGrid
        lastWeek={lastWeek}
        rows={seasons.map(season => ({
          year: season.year,
          weeks: new Map(
            season.weeks.map((week): [number, WeekGridCell] => [
              week.week,
              {
                value: signed(week.net),
                title: describeWeek(week),
                tone: week.missed
                  ? MISSED_TONE
                  : rankTone(week.rank, week.fieldSize),
                won: week.rank === 1 && !week.missed,
              },
            ]),
          ),
        }))}
      />
      <WeekLegend>
        <WonKey sample='+150' />
        <ScaleKey />
        {anyMissed && (
          <LegendItem swatch={<Swatch tone={MISSED_TONE} />}>
            Missed week
          </LegendItem>
        )}
      </WeekLegend>
    </ProfileSection>
  );
}

/**
 * A win rate as a bar out from 50%, the break-even line at even money, with
 * the field's rate as a tick. The track runs 25% to 75%, which is further than
 * any bucket with a real number of bets has gone.
 */
/**
 * Even money means 50% is break-even, so it is drawn through the bar rather
 * than as a tick, and the consensus is a dot - a different shape, so the two
 * are never mistaken for each other.
 */
const BREAK_EVEN_LINE =
  'absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-slate-300';
const CONSENSUS_DOT =
  'absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-sky-300';

function WinRateBar({
  member,
  field,
}: {
  member: number | null;
  field: number | null;
}) {
  const position = (rate: number) =>
    Math.min(100, Math.max(0, ((rate - 0.25) / 0.5) * 100));

  return (
    <div
      aria-hidden='true'
      className='relative h-2 w-full min-w-[6rem] rounded-full bg-slate-700'
    >
      <div className={clsx('left-1/2', BREAK_EVEN_LINE)} />
      {member !== null && (
        <div
          className={clsx(
            'absolute inset-y-0 rounded-full',
            member >= 0.5 ? 'bg-emerald-400' : 'bg-rose-400',
          )}
          style={{
            left: `${Math.min(50, position(member))}%`,
            width: `${Math.abs(position(member) - 50)}%`,
          }}
        />
      )}
      {field !== null && (
        <div
          className={CONSENSUS_DOT}
          style={{ left: `${position(field)}%` }}
        />
      )}
    </div>
  );
}

/**
 * One row per bucket: how many bets went there, how they did, and how the rest
 * of the field did with the same kind of bet.
 */
function SplitTable({
  buckets,
  heading,
  showField = true,
}: {
  buckets: SplitBucket[];
  heading: string;
  showField?: boolean;
}) {
  const memberBets = buckets.reduce((total, b) => total + b.member.bets, 0);

  return (
    <ProfileTable
      headers={[
        heading,
        'Bets',
        'Record',
        showField ? 'Win % vs consensus' : 'Win %',
        'Net',
      ]}
      numericColumns={[1, 2, 4]}
    >
      {buckets.map(bucket => (
        <tr key={bucket.key} className='border-b border-slate-700/70'>
          <td className='whitespace-nowrap px-2 py-2 text-slate-100'>
            {bucket.label}
          </td>
          <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
            {bucket.member.bets}
            <span className='ml-1.5 text-xs text-slate-400'>
              {memberBets > 0
                ? `${Math.round((bucket.member.bets / memberBets) * 100)}%`
                : ''}
            </span>
          </td>
          <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
            {record(bucket.member)}
          </td>
          <td
            className='w-1/2 px-2 py-2 tabular-nums'
            title={
              showField
                ? `Consensus: ${pct(bucket.field.winRate)} on ${plural(
                    bucket.field.bets,
                    'bet',
                  )}`
                : undefined
            }
          >
            <div className='flex items-center gap-3'>
              <span className='w-24 shrink-0 whitespace-nowrap'>
                {pct(bucket.member.winRate)}
                {showField && (
                  <span className='ml-1.5 text-xs text-slate-400'>
                    {pct(bucket.field.winRate)}
                  </span>
                )}
              </span>
              <WinRateBar
                member={bucket.member.bets > 0 ? bucket.member.winRate : null}
                field={showField ? bucket.field.winRate : null}
              />
            </div>
          </td>
          <td
            className={clsx(
              'whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums',
              signedTone(bucket.member.net),
            )}
          >
            {signed(bucket.member.net)}
          </td>
        </tr>
      ))}
    </ProfileTable>
  );
}

function WinRateKey() {
  return (
    <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
      <span className='inline-flex items-center gap-1.5'>
        <span className='relative inline-block h-3 w-3'>
          <span className={clsx('left-1/2', BREAK_EVEN_LINE)} />
        </span>
        Break even
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <span className='relative inline-block h-3 w-3'>
          <span className={clsx('left-1/2', CONSENSUS_DOT)} />
        </span>
        Consensus: how everyone else&rsquo;s bets of the same kind did
      </span>
    </span>
  );
}

/** How their bets on one side of the line have gone. */
function SideCard({
  bucket,
  share,
  tone,
}: {
  bucket: SplitBucket;
  share: number;
  tone: string;
}) {
  const { member } = bucket;
  const averageBet = member.bets > 0 ? member.wagered / member.bets : null;

  return (
    <CareerCard
      title={
        <span className='inline-flex items-center gap-2'>
          <span
            aria-hidden='true'
            className={clsx('inline-block h-2 w-2 rounded-full', tone)}
          />
          {bucket.label}
        </span>
      }
      lead={
        <>
          {pct(member.winRate)}
          <LeadContext>
            <WinLoss
              wins={member.wins}
              losses={member.losses}
              ties={member.pushes}
            />
          </LeadContext>
        </>
      }
      meter={<WinRateBar member={member.winRate} field={null} />}
    >
      <MiniStat
        label='Net'
        value={signed(member.net)}
        tone={signedTone(member.net)}
      />
      <MiniStat
        label='Share'
        value={`${Math.round(share * 100)}%`}
        hint='Share of their bets'
      />
      <MiniStat
        label='Average Bet'
        value={averageBet === null ? '—' : averageBet.toFixed(1)}
      />
    </CareerCard>
  );
}

const SIDE_TONE: Record<string, string> = {
  favorite: 'bg-amber-400',
  underdog: 'bg-violet-400',
  pick: 'bg-slate-400',
};

/**
 * Whether they give points or take them, how that has gone, and which lines
 * they do best on - all next to the rest of the field.
 */
function FavoritesAndUnderdogs({ splits }: { splits: PoolSplits }) {
  const memberTotal = splits.side.reduce((t, b) => t + b.member.bets, 0);
  const fieldTotal = splits.side.reduce((t, b) => t + b.field.bets, 0);
  const shareOf = (bucket: SplitBucket) =>
    memberTotal > 0 ? bucket.member.bets / memberTotal : 0;
  const fieldShareOf = (bucket: SplitBucket) =>
    fieldTotal > 0 ? bucket.field.bets / fieldTotal : 0;

  const favorite = splits.side.find(bucket => bucket.key === 'favorite');
  const underdog = splits.side.find(bucket => bucket.key === 'underdog');

  return (
    <ProfileSection title='Favorites & Underdogs' footnote={<WinRateKey />}>
      <ShareBar
        buckets={splits.side}
        shareOf={shareOf}
        consensus={favorite ? fieldShareOf(favorite) : null}
      />
      <div className='mb-6 mt-4 grid gap-3 md:grid-cols-2'>
        {[favorite, underdog].map(
          bucket =>
            bucket && (
              <SideCard
                key={bucket.key}
                bucket={bucket}
                share={shareOf(bucket)}
                tone={SIDE_TONE[bucket.key]}
              />
            ),
        )}
      </div>
      <h4 className='m-0 mb-2 text-sm font-semibold text-slate-300'>
        By the line
      </h4>
      <SplitTable buckets={splits.line} heading='Line' />
    </ProfileSection>
  );
}

/**
 * How their bets split between favorites and underdogs, with a tick where the
 * consensus split falls - so a lean either way shows as the gap between the
 * two.
 */
function ShareBar({
  buckets,
  shareOf,
  consensus,
}: {
  buckets: SplitBucket[];
  shareOf: (bucket: SplitBucket) => number;
  /** The field's share on favorites, which is where the first segment ends. */
  consensus: number | null;
}) {
  return (
    <div className='relative'>
      <div className='flex h-6 gap-0.5 overflow-hidden rounded'>
        {buckets
          .filter(bucket => shareOf(bucket) > 0)
          .map(bucket => (
            <div
              key={bucket.key}
              className={clsx(
                'flex items-center overflow-hidden whitespace-nowrap px-2 text-xs font-semibold text-slate-950',
                SIDE_TONE[bucket.key],
                bucket.key === 'underdog' && 'justify-end',
              )}
              style={{ width: `${shareOf(bucket) * 100}%` }}
              title={`${bucket.label}: ${Math.round(shareOf(bucket) * 100)}%`}
            >
              {shareOf(bucket) >= 0.12 &&
                `${bucket.label} ${Math.round(shareOf(bucket) * 100)}%`}
            </div>
          ))}
      </div>
      {consensus !== null && (
        <div
          className='absolute -inset-y-1 w-1 -translate-x-1/2 rounded-full bg-sky-300 shadow'
          style={{ left: `${consensus * 100}%` }}
          title={`Consensus: ${Math.round(consensus * 100)}% favorites`}
        />
      )}
    </div>
  );
}

/** The other ways to slice a bet: its size, the venue, the crowd and the clock. */
function Tendencies({ splits }: { splits: PoolSplits }) {
  return (
    <ProfileSection title='Tendencies' footnote={<WinRateKey />}>
      {/* min-w-0 lets each table scroll inside its cell on a phone, rather
          than widening the grid past the screen. */}
      <div className='grid gap-6 xl:grid-cols-2 [&>*]:min-w-0'>
        <SplitTable buckets={splits.size} heading='Bet size' />
        <SplitTable buckets={splits.venue} heading='Venue' />
        <SplitTable buckets={splits.slot} heading='Kickoff' />
        <div>
          <SplitTable
            buckets={splits.crowd}
            heading='Rest of the field'
            showField={false}
          />
        </div>
      </div>
    </ProfileSection>
  );
}

type TeamSort = 'net' | 'backing' | 'fading' | 'bets';

const TEAM_SORTS: { value: TeamSort; label: string }[] = [
  { value: 'net', label: 'Total' },
  { value: 'backing', label: 'Backing' },
  { value: 'fading', label: 'Fading' },
  { value: 'bets', label: 'Most bet' },
];

const TEAMS_PREVIEW = 12;

const teamBets = (row: PoolTeamRow) => row.backing.bets + row.fading.bets;

function sortTeams(rows: PoolTeamRow[], sort: TeamSort) {
  const value = (row: PoolTeamRow) =>
    sort === 'net'
      ? row.net
      : sort === 'backing'
      ? row.backing.net
      : sort === 'fading'
      ? row.fading.net
      : teamBets(row);
  return [...rows].sort(
    (a, b) => value(b) - value(a) || a.team.localeCompare(b.team),
  );
}

/** A net as a bar out from the middle, scaled to the widest in the table. */
function NetBar({ value, widest }: { value: number; widest: number }) {
  const width = widest > 0 ? (Math.abs(value) / widest) * 50 : 0;
  return (
    <div
      aria-hidden='true'
      className='relative hidden h-2 w-24 rounded-full bg-slate-700/60 sm:block'
    >
      <div className='absolute inset-y-0 left-1/2 w-px bg-slate-500' />
      <div
        className={clsx(
          'absolute inset-y-0 rounded-full',
          value >= 0 ? 'bg-emerald-400' : 'bg-rose-400',
        )}
        style={{
          left: value >= 0 ? '50%' : `${50 - width}%`,
          width: `${width}%`,
        }}
      />
    </div>
  );
}

function TeamCallout({
  title,
  row,
  names,
  children,
}: {
  title: string;
  row: PoolTeamRow | undefined;
  names: Record<string, string>;
  children: ReactNode;
}) {
  if (!row) return null;
  return (
    <div className='rounded-md bg-slate-900/50 p-4'>
      <h4 className='m-0 text-sm font-semibold text-slate-300'>{title}</h4>
      <div className='mt-2 text-2xl font-bold leading-none text-white'>
        {row.team}
        <span className='ml-2 text-sm font-normal text-slate-400'>
          {names[row.team] ?? ''}
        </span>
      </div>
      <div className='mt-1.5 text-sm text-slate-400'>{children}</div>
    </div>
  );
}

/**
 * A team's bets split into backing it and fading it, as a bar with each side's
 * count and net at its end.
 */
function BackedFaded({ row }: { row: PoolTeamRow }) {
  const total = teamBets(row);
  const sides = [
    { label: 'Backed', side: row.backing, tone: 'bg-sky-400' },
    { label: 'Faded', side: row.fading, tone: 'bg-violet-400' },
  ];

  return (
    <>
      <span>
        {plural(total, 'bet')},{' '}
        <span className={clsx('font-semibold', signedTone(row.net))}>
          {signed(row.net)}
        </span>
      </span>
      <div
        aria-hidden='true'
        className='mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-700'
      >
        {sides
          .filter(({ side }) => side.bets > 0)
          .map(({ label, side, tone }) => (
            <div
              key={label}
              className={tone}
              style={{ width: `${(side.bets / total) * 100}%` }}
            />
          ))}
      </div>
      <div className='mt-2 flex justify-between gap-2 text-xs'>
        {sides.map(({ label, side, tone }, index) => (
          <span
            key={label}
            className={clsx(
              'inline-flex items-center gap-1.5',
              index === 1 && 'flex-row-reverse',
            )}
          >
            <span
              aria-hidden='true'
              className={clsx('inline-block h-1.5 w-3 rounded-full', tone)}
            />
            <span className='text-slate-300'>
              {label} {side.bets}
            </span>
            <span className={clsx('font-semibold', signedTone(side.net))}>
              {signed(side.net)}
            </span>
          </span>
        ))}
      </div>
    </>
  );
}

/**
 * Every team they have bet on or against. Backing and fading are kept apart,
 * since a team they always lose with and always win against nets to nothing.
 */
function Teams({
  rows,
  names,
}: {
  rows: PoolTeamRow[];
  names: Record<string, string>;
}) {
  const [sort, setSort] = useState<TeamSort>('net');
  const [showAll, setShowAll] = useState(false);
  const sorted = sortTeams(rows, sort);
  const visible = showAll ? sorted : sorted.slice(0, TEAMS_PREVIEW);
  const widest = Math.max(
    ...rows.flatMap(row => [
      Math.abs(row.backing.net),
      Math.abs(row.fading.net),
      Math.abs(row.net),
    ]),
    1,
  );

  const mostProfitable = rows[0]?.net > 0 ? rows[0] : undefined;
  const leastProfitable =
    rows[rows.length - 1]?.net < 0 ? rows[rows.length - 1] : undefined;
  const mostBet = sortTeams(rows, 'bets')[0];

  return (
    <ProfileSection
      title='By NFL Team'
      action={
        <SegmentedControl
          label='Sort by'
          value={sort}
          onChange={setSort}
          options={TEAM_SORTS}
        />
      }
    >
      <div className='mb-5 grid gap-3 sm:grid-cols-3'>
        <TeamCallout title='Most Profitable' row={mostProfitable} names={names}>
          {mostProfitable && <BackedFaded row={mostProfitable} />}
        </TeamCallout>
        <TeamCallout
          title='Least Profitable'
          row={leastProfitable}
          names={names}
        >
          {leastProfitable && <BackedFaded row={leastProfitable} />}
        </TeamCallout>
        <TeamCallout title='Most Often Bet' row={mostBet} names={names}>
          {mostBet && <BackedFaded row={mostBet} />}
        </TeamCallout>
      </div>

      <ProfileTable
        headers={['Team', 'Backing', 'Fading', 'Total']}
        numericColumns={[3]}
      >
        {visible.map(row => (
          <tr key={row.team} className='border-b border-slate-700/70'>
            <td
              className='whitespace-nowrap px-2 py-2 font-medium text-slate-100'
              title={names[row.team]}
            >
              {row.team}
            </td>
            <TeamSide side={row.backing} widest={widest} />
            <TeamSide side={row.fading} widest={widest} />
            <td
              className={clsx(
                'whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums',
                signedTone(row.net),
              )}
            >
              {signed(row.net)}
            </td>
          </tr>
        ))}
      </ProfileTable>
      {rows.length > TEAMS_PREVIEW && (
        <ShowAllButton
          total={rows.length}
          noun='teams'
          showAll={showAll}
          onToggle={() => setShowAll(value => !value)}
        />
      )}
    </ProfileSection>
  );
}

/** One side's record and net, with the net drawn as a bar beside it. */
function TeamSide({
  side,
  widest,
}: {
  side: PoolTeamRow['backing'];
  widest: number;
}) {
  return (
    <td className='whitespace-nowrap px-2 py-2 tabular-nums'>
      {side.bets > 0 ? (
        <div className='flex items-center gap-3'>
          <span className='w-24 shrink-0 text-right'>
            <span className='text-slate-300'>{record(side)}</span>
            <span className={clsx('ml-2', signedTone(side.net))}>
              {signed(side.net)}
            </span>
          </span>
          <NetBar value={side.net} widest={widest} />
        </div>
      ) : (
        <span className='text-slate-400'>—</span>
      )}
    </td>
  );
}

const RESULT_TAG: Record<PoolBet['result'], { tone: TagTone; label: string }> =
  {
    win: { tone: 'win', label: 'Won' },
    loss: { tone: 'loss', label: 'Lost' },
    push: { tone: 'neutral', label: 'Push' },
  };

function BetLog({ seasons }: { seasons: PoolSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);

  const bets = seasons
    .filter(season => year === 'all' || season.year === year)
    .flatMap(season =>
      [...season.weeks]
        .reverse()
        .flatMap(week =>
          [...week.bets].sort(
            (a, b) =>
              new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
          ),
        ),
    );

  return (
    <ProfileSection
      title='Bet Log'
      action={<YearFilter years={years} value={year} onChange={setYear} />}
    >
      <ProfileTable
        headers={[
          'Year',
          'Week',
          'Bet',
          'Amount',
          'Final',
          'Cover',
          'Net',
          'Result',
        ]}
        numericColumns={[3, 5, 6]}
      >
        {bets.map((bet, index) => (
          <tr
            key={`${bet.year}-${bet.week}-${bet.team}-${index}`}
            className='border-b border-slate-700/70'
          >
            <td className='px-2 py-2'>{bet.year}</td>
            <td className='px-2 py-2 tabular-nums'>{bet.week}</td>
            <td className='whitespace-nowrap px-2 py-2'>
              <span className='font-medium text-slate-100'>
                {bet.team} {line(bet.spread)}
              </span>
              <span className='ml-1.5 text-slate-400'>
                {bet.isHome ? 'vs' : '@'} {bet.opponent}
              </span>
            </td>
            <td
              className={clsx(
                'px-2 py-2 text-right tabular-nums',
                bet.amount >= MAX_BET && 'font-semibold text-slate-100',
              )}
            >
              {bet.amount}
            </td>
            <td className='whitespace-nowrap px-2 py-2 tabular-nums text-slate-300'>
              {bet.teamScore}–{bet.opponentScore}
            </td>
            <td
              className={clsx(
                'px-2 py-2 text-right tabular-nums',
                signedTone(bet.coverMargin),
              )}
            >
              {signed(bet.coverMargin, bet.coverMargin % 1 === 0 ? 0 : 1)}
            </td>
            <td
              className={clsx(
                'px-2 py-2 text-right font-medium tabular-nums',
                signedTone(bet.net),
              )}
            >
              {signed(bet.net)}
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              <Tag tone={RESULT_TAG[bet.result].tone}>
                {RESULT_TAG[bet.result].label}
              </Tag>
              {bet.fieldShare !== null && bet.fieldShare < 0.5 && (
                <Tag
                  tone='accent'
                  className='ml-1'
                  title={`${Math.round(
                    bet.fieldShare * 100,
                  )}% of the others who bet this game took the same side`}
                >
                  Contrarian
                </Tag>
              )}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}
