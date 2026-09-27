import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import RangeBar from '~/components/layout/profile/RangeBar';
import YearFilter from '~/components/layout/profile/YearFilter';
import { requireProfileAccess } from '~/models/profile/access.server';
import { getQbStreamingProfile } from '~/models/profile/qbStreaming.server';
import type {
  QbCareer,
  QbExposureRow,
  QbPick,
  QbSeason,
  QbSideCareer,
  QbWeek,
} from '~/models/profile/qbStreamingProfile';
import {
  QB_STREAMING_COUNTING_WEEKS,
  QB_STREAMING_TOP_WEEKS_FROM_YEAR,
} from '~/models/profile/sideGameScoring';
import type { ProfileSummary } from '~/models/profile/summary.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getQbStreamingProfile(userId) });
};

const pts = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : value.toFixed(digits);

/** "+2.10", "−1.35" - a proper minus, so the column lines up. */
const signed = (value: number, digits = 2) =>
  value > 0
    ? `+${value.toFixed(digits)}`
    : value < 0
    ? `−${(-value).toFixed(digits)}`
    : (0).toFixed(digits);

const signedTone = (value: number | null) =>
  value === null || value === 0
    ? 'text-slate-400'
    : value > 0
    ? 'text-emerald-300'
    : 'text-rose-300';

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const ordinal = (rank: number) => {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
};

/**
 * Standard and deep picks keep one colour each everywhere on the tab, so the
 * split bars in Most Streamed read without a legend once you have seen the
 * cards.
 */
const SIDE = {
  standard: { label: 'Standard', dot: 'bg-sky-400' },
  deep: { label: 'Deep', dot: 'bg-violet-400' },
} as const;

type Side = keyof typeof SIDE;

function SideDot({ side }: { side: Side }) {
  return (
    <span
      aria-hidden='true'
      className={clsx('inline-block h-2 w-2 rounded-full', SIDE[side].dot)}
    />
  );
}

export default function MemberQbStreaming() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='QB Streaming'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Career career={profile.career} seasons={profile.seasons} />
      <BySeason seasons={profile.seasons} />
      <WeekByWeek seasons={profile.seasons} />
      <MostStreamed
        rows={profile.exposure}
        years={profile.seasons.map(season => season.year).reverse()}
      />
      <PickLog seasons={profile.seasons} />
    </div>
  );
}

/**
 * Four compact cards in one row. Each card's worst and best sit at the ends of
 * its bar rather than as stats of their own, which is what lets four fit.
 */
function Career({
  career,
  seasons,
}: {
  career: QbCareer;
  seasons: QbSeason[];
}) {
  const { bestWeek, worstWeek } = career;

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <SideCard
          side='standard'
          career={career.standard}
          weeks={career.weeks}
        />
        <SideCard side='deep' career={career.deep} weeks={career.weeks} />

        <CareerCard
          title='Weekly Total'
          lead={pts(career.averageWeek)}
          leadNote={<VsFieldNote value={career.vsField} />}
          meter={
            bestWeek &&
            worstWeek &&
            career.averageWeek !== null && (
              <LabelledRange
                low={worstWeek.total}
                high={bestWeek.total}
                mark={career.averageWeek}
                lowLabel={`${worstWeek.year} Wk ${worstWeek.week}`}
                highLabel={`${bestWeek.year} Wk ${bestWeek.week}`}
              />
            )
          }
        >
          <RateStat
            label='Weeks Won'
            count={career.weeklyWins}
            of={career.weeks}
            hint='Weeks with the top total of everyone who played'
            tone={career.weeklyWins > 0 ? 'text-gold' : undefined}
          />
          <RateStat
            label='Doubled Up'
            count={career.doubledWeeks}
            of={career.weeks}
            hint='Weeks the same QB was both the standard and the deep pick'
          />
        </CareerCard>

        <FinishesCard career={career} seasons={seasons} />
      </div>
    </ProfileSection>
  );
}

/** A share of weeks as the headline, with the count of weeks beside it. */
function RateStat({
  label,
  count,
  of,
  hint,
  tone,
}: {
  label: string;
  count: number;
  of: number;
  hint: string;
  tone?: string;
}) {
  return (
    <MiniStat
      label={label}
      value={of > 0 ? `${Math.round((count / of) * 100)}%` : '—'}
      detail={plural(count, 'wk')}
      hint={hint}
      tone={tone}
    />
  );
}

/**
 * Finished seasons grouped by how they ended, lightest for the best, so the
 * bar reads the same without the gold. Each season sits in its best band
 * only, so a title is gold alone rather than also filling Top 3 and Top 5.
 */
const FINISH_BANDS = [
  { label: 'Won', max: 1, tone: 'bg-gold' },
  { label: 'Top 3', max: 3, tone: 'bg-slate-200' },
  { label: 'Top 5', max: 5, tone: 'bg-slate-400' },
  { label: 'Outside Top 5', max: Infinity, tone: 'bg-slate-600' },
];

/** How their seasons have ended, as counts rather than a list of years. */
function FinishesCard({
  career,
  seasons,
}: {
  career: QbCareer;
  seasons: QbSeason[];
}) {
  const finished = seasons.flatMap(season =>
    season.finish && !season.inProgress ? [season.finish.rank] : [],
  );

  // A member still in their first season has no finishes yet; show where
  // they stand instead.
  if (finished.length === 0) {
    return career.current ? (
      <CareerCard
        title='Standing'
        lead={ordinal(career.current.rank)}
        leadNote={`of ${career.current.fieldSize} so far in ${career.current.year}`}
      >
        <MiniStat label='Weeks Played' value={career.weeks} />
      </CareerCard>
    ) : null;
  }

  const bandCounts = FINISH_BANDS.map((band, index) => ({
    ...band,
    count: finished.filter(
      rank => rank <= band.max && rank > (FINISH_BANDS[index - 1]?.max ?? 0),
    ).length,
  }));

  return (
    <CareerCard
      title='Finishes'
      lead={
        career.titles > 0 ? (
          <span className='text-gold'>
            🏆{career.titles > 1 && ` × ${career.titles}`}
          </span>
        ) : (
          ordinal(career.bestFinish!.rank)
        )
      }
      leadNote={[
        career.titles > 0
          ? plural(career.titles, 'title')
          : `best finish, ${career.bestFinish!.year}`,
        `avg ${career.averageFinish!.toFixed(1)}`,
        career.current &&
          `${ordinal(career.current.rank)} in ${career.current.year}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      meter={
        <>
          <div
            aria-hidden='true'
            className='flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-700'
          >
            {bandCounts
              .filter(band => band.count > 0)
              .map(band => (
                <div
                  key={band.label}
                  className={band.tone}
                  style={{ width: `${(band.count / finished.length) * 100}%` }}
                />
              ))}
          </div>
          <div className='mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[0.65rem] text-slate-400'>
            {bandCounts.map(band => (
              <span
                key={band.label}
                className='inline-flex items-center gap-1'
                title={`${plural(band.count, 'season')}`}
              >
                <span
                  aria-hidden='true'
                  className={clsx(
                    'inline-block h-1.5 w-3 rounded-full',
                    band.tone,
                  )}
                />
                {band.label}
              </span>
            ))}
          </div>
        </>
      }
    >
      <MiniStat
        label='Wins'
        value={career.titles}
        tone={career.titles > 0 ? 'text-gold' : undefined}
      />
      <MiniStat label='Top 3' value={career.topThrees} />
      <MiniStat label='Top 5' value={career.topFives} />
    </CareerCard>
  );
}

function VsFieldNote({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <>
      <span className={clsx('tabular-nums', signedTone(value))}>
        {signed(value)}
      </span>{' '}
      a week vs the field
    </>
  );
}

/** A RangeBar with its two ends named underneath. */
function LabelledRange({
  low,
  high,
  mark,
  lowLabel,
  highLabel,
}: {
  low: number;
  high: number;
  mark: number;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <>
      <RangeBar low={low} high={high} mark={mark} />
      <div className='mt-2 flex justify-between gap-2 text-xs'>
        <span className='min-w-0 truncate'>
          <span className='font-semibold tabular-nums text-rose-300'>
            {low.toFixed(2)}
          </span>{' '}
          <span className='text-slate-500'>{lowLabel}</span>
        </span>
        <span className='min-w-0 truncate text-right'>
          <span className='text-slate-500'>{highLabel}</span>{' '}
          <span className='font-semibold tabular-nums text-emerald-300'>
            {high.toFixed(2)}
          </span>
        </span>
      </div>
    </>
  );
}

/** The average standard or deep pick, against the rest of the field's. */
function SideCard({
  side,
  career,
  weeks,
}: {
  side: Side;
  career: QbSideCareer;
  weeks: number;
}) {
  const { best, worst } = career;

  return (
    <CareerCard
      title={
        <span className='inline-flex items-center gap-2'>
          <SideDot side={side} />
          {SIDE[side].label} Pick
        </span>
      }
      lead={pts(career.average)}
      leadNote={<VsFieldNote value={career.vsField} />}
      meter={
        best &&
        worst &&
        career.average !== null && (
          <LabelledRange
            low={worst.points}
            high={best.points}
            mark={career.average}
            lowLabel={worst.name}
            highLabel={best.name}
          />
        )
      }
    >
      <RateStat
        label='Beat the Field'
        count={career.beatFieldWeeks}
        of={weeks}
        hint={`Weeks this pick outscored the average ${side} pick`}
      />
      <RateStat
        label='Top QB Picked'
        count={career.topPickWeeks}
        of={weeks}
        hint={
          side === 'standard'
            ? 'Weeks this pick was the top-scoring QB on the whole list'
            : 'Weeks this pick was the top-scoring QB on the deep list'
        }
      />
    </CareerCard>
  );
}

function VsField({ value, side }: { value: number | null; side: Side }) {
  if (value === null) return null;
  return (
    <span
      className={clsx('ml-1.5 cursor-help text-xs', signedTone(value))}
      title={`${signed(
        value,
      )} a week against the average ${side} pick of everyone who played`}
    >
      {signed(value)}
    </span>
  );
}

function BySeason({ seasons }: { seasons: QbSeason[] }) {
  return (
    <ProfileSection title='By Season'>
      <ProfileTable
        headers={[
          'Year',
          'Finish',
          'Total',
          'Avg Week',
          'Avg Standard',
          'Avg Deep',
          'Best Wk',
          'Weeks Won',
        ]}
        numericColumns={[2, 3, 4, 5, 6, 7]}
      >
        {seasons.map((season, index) => (
          <Fragment key={season.year}>
            {/* Seasons are newest first, so the rule change falls between
                the last best-twelve season and the first season before it. */}
            {!season.usesTopWeeks && seasons[index - 1]?.usesTopWeeks && (
              <ScoringRuleDivider />
            )}
            <tr className='border-b border-slate-700/70'>
              <td className='px-2 py-2'>
                <Link to={`/games/qb-streaming/standings/${season.year}`}>
                  {season.year}
                </Link>
              </td>
              <td className='whitespace-nowrap px-2 py-2'>
                <SeasonFinish season={season} />
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums'>
                {pts(season.total)}
              </td>
              <td className='px-2 py-2 text-right tabular-nums'>
                {pts(season.averageWeek)}
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
                {pts(season.averageStandard)}
                <VsField value={season.standardVsField} side='standard' />
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
                {pts(season.averageDeep)}
                <VsField value={season.deepVsField} side='deep' />
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
                {season.bestWeek ? (
                  <>
                    <span className='text-emerald-300'>
                      {season.bestWeek.total.toFixed(2)}
                    </span>
                    <span className='ml-1.5 text-xs text-slate-500'>
                      Wk {season.bestWeek.week}
                    </span>
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td
                className={clsx(
                  'px-2 py-2 text-right tabular-nums',
                  season.weeklyWins > 0 ? 'text-gold' : 'text-slate-400',
                )}
              >
                {season.weeklyWins}
              </td>
            </tr>
          </Fragment>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

/** Marks where totals switch from every week to the best twelve. */
function ScoringRuleDivider() {
  return (
    <tr className='border-b border-slate-700/70'>
      <td
        colSpan={8}
        className='bg-slate-900/40 px-2 py-1 text-center text-xs text-slate-400'
      >
        ↑ Best {QB_STREAMING_COUNTING_WEEKS} weeks count from{' '}
        {QB_STREAMING_TOP_WEEKS_FROM_YEAR} · every week counted before ↓
      </td>
    </tr>
  );
}

function SeasonFinish({ season }: { season: QbSeason }) {
  if (!season.finish) return <>—</>;
  const champion = season.finish.rank === 1 && !season.inProgress;

  return (
    <>
      <span
        className={clsx(
          'font-medium',
          champion ? 'text-gold' : 'text-slate-100',
        )}
      >
        {champion && '🏆 '}
        {ordinal(season.finish.rank)}
        <span className='font-normal text-slate-400'>
          {' '}
          of {season.finish.fieldSize}
          {season.inProgress && ' so far'}
        </span>
      </span>
    </>
  );
}

/**
 * Where a week's total ranked in the field, bottom to top as dark red to
 * bright green. Ranking rather than raw points, so a low-scoring week across
 * the league does not paint the whole column red.
 *
 * Lightness climbs with the rank as well as hue, so the scale still reads for
 * red-green colour blindness: bright is good, dark is bad.
 */
const WEEK_SCALE = [
  { tone: 'bg-emerald-300 text-emerald-950', label: 'Top 20%' },
  { tone: 'bg-emerald-500 text-emerald-950', label: '60-80%' },
  { tone: 'bg-slate-600 text-slate-100', label: '40-60%' },
  { tone: 'bg-rose-800 text-rose-50', label: '20-40%' },
  { tone: 'bg-rose-950 text-rose-200', label: 'Bottom 20%' },
];

/**
 * Outlines a week that counted in a best-twelve season. The weeks that did not
 * count keep their colour, so a dropped week can still show it was a decent
 * score in a week when everyone scored well. Seasons that counted every week
 * get no outlines at all, since there is nothing to tell apart.
 */
/**
 * A week won is set in heavy, underlined type, so it stands out by shape and
 * never relies on its colour, which it shares with the rest of the top band.
 */
const WEEK_WON_TEXT = 'underline decoration-2 underline-offset-2';

const COUNTED_RING = 'ring-1 ring-white/90 ring-offset-1 ring-offset-slate-900';

function weekTone(week: QbWeek): string {
  const percentile =
    week.fieldSize > 1
      ? (week.fieldSize - week.rank) / (week.fieldSize - 1)
      : 1;
  // Walks down from the top band; a week won is always in it.
  const band =
    week.rank === 1
      ? 0
      : [0.8, 0.6, 0.4, 0.2].findIndex(floor => percentile >= floor);
  return WEEK_SCALE[band === -1 ? WEEK_SCALE.length - 1 : band].tone;
}

const describePicks = (week: QbWeek) =>
  week.doubled
    ? `doubled up on ${week.standard.name}, ${week.standard.points.toFixed(
        2,
      )} each`
    : `standard ${week.standard.name} ${week.standard.points.toFixed(
        2,
      )}, deep ${week.deep.name} ${week.deep.points.toFixed(2)}`;

const describeWeek = (week: QbWeek) =>
  `${week.year} Wk ${week.week}: ${week.total.toFixed(2)} pts, ${ordinal(
    week.rank,
  )} of ${week.fieldSize}${week.rank === 1 ? ', won the week' : ''}. ${
    describePicks(week).charAt(0).toUpperCase() + describePicks(week).slice(1)
  }${
    week.counts
      ? ''
      : `. Didn't count - outside the best ${QB_STREAMING_COUNTING_WEEKS}`
  }`;

/** Every season as a strip of weeks, so a career's hot and cold runs show. */
function WeekByWeek({ seasons }: { seasons: QbSeason[] }) {
  const lastWeek = Math.max(
    ...seasons.flatMap(season => season.weeks.map(week => week.week)),
  );
  const weekNumbers = Array.from({ length: lastWeek }, (_, i) => i + 1);
  const anyTopWeeks = seasons.some(season => season.usesTopWeeks);

  return (
    <ProfileSection
      title='Week by Week'
      description='Each week shaded by where it ranked among everyone who played it'
    >
      <div className='overflow-x-auto'>
        <div
          className='grid gap-1.5 p-0.5 text-xs'
          style={{
            gridTemplateColumns: `3rem repeat(${lastWeek}, minmax(3.25rem, 1fr))`,
          }}
        >
          <div />
          {weekNumbers.map(week => (
            <div key={week} className='text-center text-slate-500'>
              {week}
            </div>
          ))}

          {seasons.map(season => {
            const byWeek = new Map(season.weeks.map(week => [week.week, week]));
            return (
              <SeasonStrip key={season.year} year={season.year}>
                {weekNumbers.map(number => {
                  const week = byWeek.get(number);
                  return week ? (
                    <div
                      key={number}
                      title={describeWeek(week)}
                      className={clsx(
                        'flex h-8 items-center justify-center rounded font-semibold tabular-nums',
                        weekTone(week),
                        week.rank === 1 && WEEK_WON_TEXT,
                        season.usesTopWeeks && week.counts && COUNTED_RING,
                      )}
                    >
                      {week.total.toFixed(2)}
                      <span className='sr-only'>. {describeWeek(week)}</span>
                    </div>
                  ) : (
                    <div
                      key={number}
                      aria-hidden='true'
                      className='flex h-8 items-center justify-center rounded bg-slate-900/40 text-slate-600'
                    >
                      ·
                    </div>
                  );
                })}
              </SeasonStrip>
            );
          })}
        </div>
      </div>
      <WeekLegend showCounted={anyTopWeeks} />
    </ProfileSection>
  );
}

function SeasonStrip({
  year,
  children,
}: {
  year: number;
  children: ReactNode;
}) {
  return (
    <>
      <div className='flex h-8 items-center font-medium tabular-nums text-slate-300'>
        {year}
      </div>
      {children}
    </>
  );
}

function Swatch({ tone, children }: { tone: string; children?: ReactNode }) {
  return (
    <span
      className={clsx(
        'relative inline-flex h-4 w-5 items-center justify-center rounded-sm',
        tone,
      )}
    >
      {children}
    </span>
  );
}

function WeekLegend({ showCounted }: { showCounted: boolean }) {
  return (
    <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400'>
      <span className='inline-flex items-center gap-1.5'>
        <Swatch tone={clsx(WEEK_SCALE[0].tone, 'w-7 text-[0.65rem]')}>
          <span className={clsx('font-semibold', WEEK_WON_TEXT)}>40</span>
        </Swatch>
        Week won
      </span>
      <span className='inline-flex items-center gap-1'>
        {WEEK_SCALE[0].label}
        {WEEK_SCALE.map(({ tone, label }) => (
          <span key={tone} title={label}>
            <Swatch tone={tone} />
          </span>
        ))}
        {WEEK_SCALE[WEEK_SCALE.length - 1].label}
      </span>
      {showCounted && (
        <span className='inline-flex items-center gap-1.5'>
          <Swatch tone={clsx(WEEK_SCALE[2].tone, COUNTED_RING)} />
          Counted toward the best {QB_STREAMING_COUNTING_WEEKS} (from{' '}
          {QB_STREAMING_TOP_WEEKS_FROM_YEAR})
        </span>
      )}
    </div>
  );
}

const MOST_STREAMED_PREVIEW = 15;

/** Stronger with every week that season, so a favourite stands out. */
const yearCellTone = (count: number) =>
  count >= 5
    ? 'bg-emerald-400/80 text-emerald-950'
    : count === 4
    ? 'bg-emerald-400/65 text-emerald-950'
    : count === 3
    ? 'bg-emerald-400/50 text-white'
    : count === 2
    ? 'bg-emerald-400/35 text-white'
    : 'bg-emerald-400/20 text-white';

/** How a QB's weeks split between the two picks, most-used QB as full width. */
function PickSplitBar({ row, widest }: { row: QbExposureRow; widest: number }) {
  // A doubled-up week is two picks, so it takes two units of the bar.
  const segments = [
    { value: row.standardOnly, className: SIDE.standard.dot },
    { value: row.doubled * 2, className: DOUBLED_TONE },
    { value: row.deepOnly, className: SIDE.deep.dot },
  ];

  return (
    <div
      aria-hidden='true'
      className='hidden h-1.5 w-20 gap-0.5 overflow-hidden rounded-full bg-slate-700 sm:flex'
    >
      {segments
        .filter(segment => segment.value > 0)
        .map(segment => (
          <div
            key={segment.className}
            className={segment.className}
            style={{ width: `${(segment.value / widest) * 100}%` }}
          />
        ))}
    </div>
  );
}

const DOUBLED_TONE = 'bg-slate-200';

/** A legend entry drawn as a piece of the split bar it explains. */
function BarKey({ tone, children }: { tone: string; children: string }) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span
        aria-hidden='true'
        className={clsx('inline-block h-1.5 w-4 rounded-full', tone)}
      />
      {children}
    </span>
  );
}

const describeSplit = (row: QbExposureRow) =>
  [
    row.standardOnly > 0 && `${row.standardOnly} standard`,
    row.deepOnly > 0 && `${row.deepOnly} deep`,
    row.doubled > 0 &&
      `${plural(row.doubled, 'week')} doubled up (${row.doubled * 2} picks)`,
  ]
    .filter(Boolean)
    .join(', ');

/** The QBs they keep going back to, and when. */
function MostStreamed({
  rows,
  years,
}: {
  rows: QbExposureRow[];
  years: number[];
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, MOST_STREAMED_PREVIEW);
  const firstNumeric = 1 + years.length;
  const widest = rows[0]?.picks ?? 1;

  return (
    <ProfileSection
      title='Most Streamed'
      footnote={
        <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
          <BarKey tone={SIDE.standard.dot}>Standard pick</BarKey>
          <BarKey tone={SIDE.deep.dot}>Deep pick</BarKey>
          <BarKey tone={DOUBLED_TONE}>Doubled up (both picks)</BarKey>
        </span>
      }
    >
      <ProfileTable
        headers={['QB', ...years.map(String), 'Picks', 'Avg', 'Best', 'Worst']}
        numericColumns={[firstNumeric + 1, firstNumeric + 2, firstNumeric + 3]}
      >
        {visible.map(row => (
          <tr key={row.playerId} className='border-b border-slate-700/70'>
            <td className='whitespace-nowrap px-2 py-2 font-medium text-slate-100'>
              {row.name}
            </td>
            {years.map(year => {
              const count = row.byYear[year] ?? 0;
              return (
                <td key={year} className='px-1 py-1.5'>
                  {count > 0 ? (
                    <span
                      title={`${plural(count, 'pick')} in ${year}`}
                      className={clsx(
                        'flex h-6 min-w-[2.25rem] items-center justify-center rounded text-xs font-semibold tabular-nums',
                        yearCellTone(count),
                      )}
                    >
                      {count}
                    </span>
                  ) : (
                    <span
                      aria-hidden='true'
                      className='flex h-6 min-w-[2.25rem] items-center justify-center text-slate-600'
                    >
                      ·
                    </span>
                  )}
                </td>
              );
            })}
            <td className='px-2 py-2'>
              <div
                className='flex items-center gap-2'
                title={describeSplit(row)}
              >
                <span className='w-6 text-right font-medium tabular-nums'>
                  {row.picks}
                </span>
                <PickSplitBar row={row} widest={widest} />
              </div>
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {pts(row.averagePoints)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-slate-400'>
              {pts(row.bestPoints)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-slate-400'>
              {pts(row.worstPoints)}
            </td>
          </tr>
        ))}
      </ProfileTable>
      {rows.length > MOST_STREAMED_PREVIEW && (
        <button
          type='button'
          onClick={() => setShowAll(value => !value)}
          className='mt-3 rounded bg-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-600'
        >
          {showAll ? 'Show fewer' : `Show all ${rows.length} QBs`}
        </button>
      )}
    </ProfileSection>
  );
}

function PickCell({ pick }: { pick: QbPick }) {
  return (
    <td className='whitespace-nowrap px-2 py-2'>
      <span className='text-slate-100'>{pick.name}</span>
      <span
        className={clsx('ml-2 tabular-nums', signedTone(pick.vsField))}
        title={`${signed(pick.vsField)} vs the field's average pick`}
      >
        {pick.points.toFixed(2)}
      </span>
    </td>
  );
}

function Tag({ tone, children }: { tone: string; children: string }) {
  return (
    <span className={clsx('rounded px-1.5 py-0.5 text-xs', tone)}>
      {children}
    </span>
  );
}

function PickLog({ seasons }: { seasons: QbSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number | 'all'>(years[0]);
  const weeks = seasons
    .filter(season => year === 'all' || season.year === year)
    .flatMap(season => [...season.weeks].reverse());

  return (
    <ProfileSection
      title='Pick Log'
      description='Pick points are green when they beat the average pick that week'
      action={<YearFilter years={years} value={year} onChange={setYear} />}
    >
      <ProfileTable
        headers={['Year', 'Wk', 'Standard', 'Deep', 'Total', 'Rank', '']}
        numericColumns={[4, 5]}
      >
        {weeks.map(week => (
          <tr
            key={`${week.year}-${week.week}`}
            className={clsx(
              'border-b border-slate-700/70',
              !week.counts && 'text-slate-400',
            )}
          >
            <td className='px-2 py-2'>{week.year}</td>
            <td className='px-2 py-2 tabular-nums'>{week.week}</td>
            <PickCell pick={week.standard} />
            <PickCell pick={week.deep} />
            <td className='px-2 py-2 text-right font-medium tabular-nums'>
              {week.total.toFixed(2)}
            </td>
            <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
              {ordinal(week.rank)}
              <span className='text-slate-500'> / {week.fieldSize}</span>
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              {week.rank === 1 && (
                <Tag tone='bg-emerald-400/15 text-emerald-200'>Won week</Tag>
              )}
              {week.doubled && (
                <Tag tone='bg-violet-400/15 text-violet-200'>Doubled up</Tag>
              )}
              {!week.counts && (
                <Tag tone='bg-slate-600/40 text-slate-300'>
                  Didn&rsquo;t count
                </Tag>
              )}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}
