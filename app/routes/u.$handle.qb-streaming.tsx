import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { Fragment, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import FinishMeter from '~/components/layout/profile/FinishMeter';
import LeadContext from '~/components/layout/profile/LeadContext';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import SeasonFinish, {
  Trophies,
} from '~/components/layout/profile/SeasonFinish';
import StatusText, {
  CurrentSeason,
} from '~/components/layout/profile/StatusText';
import {
  ordinal,
  plural,
  pts,
  signed as signedBy,
  weekLabel,
} from '~/components/layout/profile/format';
import { signedTone, TEXT } from '~/components/layout/profile/tones';
import { LabelledRange } from '~/components/ui/bars';
import { YearFilter } from '~/components/ui/segmented-control';
import { ShowAllButton } from '~/components/ui/show-all-button';
import { MobileCard, MobileCards, Table } from '~/components/ui/table';
import {
  KeyList,
  LegendItem,
  LegendSwatch,
  rankTone,
  ScaleKey,
  WEEK_SCALE,
  WeekGrid,
  WonKey,
} from '~/components/ui/week-grid';
import type { WeekGridCell } from '~/components/ui/week-grid';
import { requireProfileMember } from '~/models/profile/access.server';
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
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'QB Streaming' };

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireProfileMember(request, params.handle);

  return typedjson({ profile: await getQbStreamingProfile(userId) });
};

/** Points to two places, signed - QB scores are never whole. */
const signed = (value: number) => signedBy(value, 2);

/**
 * Standard and deep picks keep one colour each everywhere on the tab, so the
 * split bars in Most Streamed read without a legend once you have seen the
 * cards.
 */
const SIDE = {
  standard: { label: 'Standard', dot: 'bg-info/20' },
  deep: { label: 'Deep', dot: 'bg-primary' },
} as const;

type Side = keyof typeof SIDE;

function SideDot({ side }: { side: Side }) {
  return (
    <span
      aria-hidden='true'
      className={clsx('inline-block h-2 w-2', SIDE[side].dot)}
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
          lead={
            <VsFieldLead value={career.averageWeek} vsField={career.vsField} />
          }
          meter={
            bestWeek &&
            worstWeek &&
            career.averageWeek !== null && (
              <LabelledRange
                low={worstWeek.total}
                high={bestWeek.total}
                mark={career.averageWeek}
                lowLabel={weekLabel(worstWeek)}
                highLabel={weekLabel(bestWeek)}
                format={value => value.toFixed(2)}
              />
            )
          }
        >
          <RateStat
            label='Weeks Won'
            count={career.weeklyWins}
            of={career.weeks}
            hint='Weeks with the top total of everyone who played'
            tone={career.weeklyWins > 0 ? TEXT.champion : undefined}
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

/** A share of weeks, with the count of weeks in the hover text. */
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
      value={of > 0 ? `${Math.round((count / of) * 100)}%` : '–'}
      hint={`${hint}: ${plural(count, 'week')}`}
      tone={tone}
    />
  );
}

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
        lead={
          <>
            {ordinal(career.current.rank)}
            <LeadContext>of {career.current.fieldSize}</LeadContext>
          </>
        }
      >
        <MiniStat label='Weeks Played' value={career.weeks} />
      </CareerCard>
    ) : null;
  }

  return (
    <CareerCard
      title='Finishes'
      lead={
        career.titles > 0 ? (
          <Trophies titles={career.titles} />
        ) : (
          ordinal(career.bestFinish!.rank)
        )
      }
      meter={<FinishMeter ranks={finished} />}
      compactStats
    >
      <MiniStat
        label='Titles'
        value={career.titles}
        tone={career.titles > 0 ? TEXT.champion : undefined}
      />
      <MiniStat label='Top 3' value={career.topThrees} />
      <MiniStat label='Top 5' value={career.topFives} />
    </CareerCard>
  );
}

/** A headline average with how far it sits from the field's, beside it. */
function VsFieldLead({
  value,
  vsField,
}: {
  value: number | null;
  vsField: number | null;
}) {
  return (
    <>
      {pts(value)}
      {vsField !== null && (
        <LeadContext>
          <span className={clsx('tabular-nums', signedTone(vsField))}>
            {signed(vsField)}
          </span>{' '}
          a week against the field
        </LeadContext>
      )}
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
      lead={<VsFieldLead value={career.average} vsField={career.vsField} />}
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
            format={value => value.toFixed(2)}
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
      className={clsx('ml-1.5 cursor-help text-sm', signedTone(value))}
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
      <Table
        headers={[
          'Year',
          'Finish',
          'Total',
          'Average Week',
          'Average Standard',
          'Average Deep',
          'Best Week',
          'Weeks Won',
        ]}
        numericColumns={[2, 3, 4, 5, 6, 7]}
        primaryColumns={[1, 2]}
      >
        {seasons.map((season, index) => (
          <Fragment key={season.year}>
            {/* Seasons are newest first, so the rule change falls between
                the last best-twelve season and the first season before it. */}
            {!season.usesTopWeeks && seasons[index - 1]?.usesTopWeeks && (
              <ScoringRuleDivider />
            )}
            <tr className='border-b border-border'>
              <td className='px-2 py-2'>
                <Link to={`/games/qb-streaming/standings/${season.year}`}>
                  {season.year}
                </Link>
                {season.inProgress && <CurrentSeason />}
              </td>
              <td className='whitespace-nowrap px-2 py-2'>
                <SeasonFinish
                  finish={season.finish}
                  champion={season.finish?.rank === 1 && !season.inProgress}
                />
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
                    <span className='text-positive'>
                      {season.bestWeek.total.toFixed(2)}
                    </span>
                    <span className='ml-1.5 text-sm text-muted-foreground'>
                      Week {season.bestWeek.week}
                    </span>
                  </>
                ) : (
                  '–'
                )}
              </td>
              <td
                className={clsx(
                  'px-2 py-2 text-right tabular-nums',
                  season.weeklyWins > 0
                    ? TEXT.champion
                    : 'text-muted-foreground',
                )}
              >
                {season.weeklyWins}
              </td>
            </tr>
          </Fragment>
        ))}
      </Table>
    </ProfileSection>
  );
}

/** Marks where totals switch from every week to the best twelve. */
function ScoringRuleDivider() {
  return (
    <tr className='border-b border-border'>
      <td
        colSpan={8}
        className='bg-background/40 px-2 py-1 text-center text-sm text-muted-foreground'
      >
        ↑ Best {QB_STREAMING_COUNTING_WEEKS} weeks count from{' '}
        {QB_STREAMING_TOP_WEEKS_FROM_YEAR}; every week counted before ↓
      </td>
    </tr>
  );
}

/**
 * Outlines a week that counted in a best-twelve season. The weeks that did not
 * count keep their colour, so a dropped week can still show it was a decent
 * score in a week when everyone scored well. Seasons that counted every week
 * get no outlines at all, since there is nothing to tell apart.
 */
const COUNTED_RING = 'ring-1 ring-border ring-offset-1 ring-offset-background';

const describePicks = (week: QbWeek) =>
  week.doubled
    ? `doubled up on ${week.standard.name}, ${week.standard.points.toFixed(
        2,
      )} each`
    : `standard ${week.standard.name} ${week.standard.points.toFixed(
        2,
      )}, deep ${week.deep.name} ${week.deep.points.toFixed(2)}`;

const describeWeek = (week: QbWeek) =>
  `${weekLabel(week)}: ${week.total.toFixed(2)} points, ${ordinal(
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

  return (
    <ProfileSection
      title='Week by Week'
      info={
        <KeyList>
          <WonKey sample='40' />
          <ScaleKey />
          {seasons.some(season => season.usesTopWeeks) && (
            <LegendItem
              swatch={
                <LegendSwatch tone={clsx(WEEK_SCALE[2].tone, COUNTED_RING)} />
              }
            >
              Counted toward the best {QB_STREAMING_COUNTING_WEEKS} (from{' '}
              {QB_STREAMING_TOP_WEEKS_FROM_YEAR})
            </LegendItem>
          )}
        </KeyList>
      }
      description='Each week shaded by where it ranked among everyone who played it.'
    >
      <WeekGrid
        lastWeek={lastWeek}
        rows={seasons.map(season => ({
          year: season.year,
          weeks: new Map(
            season.weeks.map((week): [number, WeekGridCell] => [
              week.week,
              {
                value: week.total.toFixed(2),
                title: describeWeek(week),
                tone: rankTone(week.rank, week.fieldSize),
                won: week.rank === 1,
                className: clsx(
                  season.usesTopWeeks && week.counts && COUNTED_RING,
                ),
              },
            ]),
          ),
        }))}
      />
    </ProfileSection>
  );
}

const MOST_STREAMED_PREVIEW = 15;

/** Stronger with every week that season, so a favourite stands out. */
const yearCellTone = (count: number) =>
  count >= 5
    ? 'bg-positive/60 text-foreground'
    : count === 4
    ? 'bg-positive/50 text-foreground'
    : count === 3
    ? 'bg-positive/40 text-foreground'
    : count === 2
    ? 'bg-positive/30 text-foreground'
    : 'bg-positive/20 text-foreground';

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
      className='hidden h-1.5 w-20 gap-0.5 overflow-hidden bg-secondary sm:flex'
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

const DOUBLED_TONE = 'bg-foreground';

/** A legend entry drawn as a piece of the split bar it explains. */
function BarKey({ tone, children }: { tone: string; children: string }) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <span
        aria-hidden='true'
        className={clsx('inline-block h-1.5 w-4', tone)}
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
      info={
        <KeyList>
          <BarKey tone={SIDE.standard.dot}>Standard Pick</BarKey>
          <BarKey tone={SIDE.deep.dot}>Deep Pick</BarKey>
          <BarKey tone={DOUBLED_TONE}>Doubled Up (Both Picks)</BarKey>
        </KeyList>
      }
    >
      <Table
        headers={[
          'QB',
          ...years.map(String),
          'Picks',
          'Average',
          'Best',
          'Worst',
        ]}
        numericColumns={[firstNumeric + 1, firstNumeric + 2, firstNumeric + 3]}
        // The QB, how often and how well; the years open from each row.
        primaryColumns={[firstNumeric, firstNumeric + 1]}
      >
        {visible.map(row => (
          <tr key={row.playerId} className='border-b border-border'>
            <td className='whitespace-nowrap px-2 py-2 font-medium text-foreground'>
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
                        'flex h-6 min-w-[2.25rem] items-center justify-center text-sm font-semibold tabular-nums',
                        yearCellTone(count),
                      )}
                    >
                      {count}
                    </span>
                  ) : (
                    <span
                      aria-hidden='true'
                      className='flex h-6 min-w-[2.25rem] items-center justify-center text-muted-foreground'
                    >
                      –
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
            <td className='px-2 py-2 text-right tabular-nums text-muted-foreground'>
              {pts(row.bestPoints)}
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-muted-foreground'>
              {pts(row.worstPoints)}
            </td>
          </tr>
        ))}
      </Table>
      {rows.length > MOST_STREAMED_PREVIEW && (
        <ShowAllButton
          total={rows.length}
          noun='QBs'
          showAll={showAll}
          onToggle={() => setShowAll(value => !value)}
        />
      )}
    </ProfileSection>
  );
}

/** A pick's QB and points, with its margin over the field's average pick. */
function PickSummary({ pick }: { pick: QbPick }) {
  return (
    <>
      <span className='text-foreground'>{pick.name}</span>
      <span className='ml-2 tabular-nums'>{pick.points.toFixed(2)}</span>
      <span
        className={clsx(
          'ml-1.5 text-sm tabular-nums',
          signedTone(pick.vsField),
        )}
        title={`${signed(pick.vsField)} against the field's average pick`}
      >
        {signed(pick.vsField)}
      </span>
    </>
  );
}

function PickCell({ pick }: { pick: QbPick }) {
  return (
    <td className='whitespace-nowrap px-2 py-2'>
      <PickSummary pick={pick} />
    </td>
  );
}

/** What set a week apart: won, doubled up, or left out of the best twelve. */
function WeekTags({ week }: { week: QbWeek }) {
  return (
    <>
      {week.rank === 1 && <StatusText tone='win'>Won week</StatusText>}
      {week.doubled && <StatusText tone='accent'>Doubled up</StatusText>}
      {!week.counts && (
        <StatusText tone='neutral'>Didn&rsquo;t count</StatusText>
      )}
    </>
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
      action={<YearFilter years={years} value={year} onChange={setYear} />}
    >
      <Table
        headers={['Year', 'Week', 'Standard', 'Deep', 'Total', 'Rank', '']}
        numericColumns={[4, 5]}
        mobileCards={
          <MobileCards>
            {weeks.map(week => (
              <MobileCard
                key={`${week.year}-${week.week}`}
                title={
                  <span
                    className={clsx(!week.counts && 'text-muted-foreground')}
                  >
                    {year === 'all' ? weekLabel(week) : `Week ${week.week}`}
                  </span>
                }
                subtitle={`${ordinal(week.rank)} of ${week.fieldSize}`}
                value={week.total.toFixed(2)}
                status={<WeekTags week={week} />}
              >
                <ul className='m-0 list-none space-y-0.5 p-0 text-sm'>
                  <li>
                    <span className='mr-1.5 text-sm text-muted-foreground'>
                      Standard
                    </span>
                    <PickSummary pick={week.standard} />
                  </li>
                  <li>
                    <span className='mr-1.5 text-sm text-muted-foreground'>
                      Deep
                    </span>
                    <PickSummary pick={week.deep} />
                  </li>
                </ul>
              </MobileCard>
            ))}
          </MobileCards>
        }
      >
        {weeks.map(week => (
          <tr
            key={`${week.year}-${week.week}`}
            className={clsx(
              'border-b border-border',
              !week.counts && 'text-muted-foreground',
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
              <span className='text-muted-foreground'> / {week.fieldSize}</span>
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              <span className='inline-flex gap-1'>
                <WeekTags week={week} />
              </span>
            </td>
          </tr>
        ))}
      </Table>
    </ProfileSection>
  );
}
