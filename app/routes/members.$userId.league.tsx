import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import { requireProfileAccess } from '~/models/profile/access.server';
import type {
  GameLogRow,
  HeadToHeadRow,
  SeasonRow,
  TierRecord,
} from '~/models/profile/league.server';
import { getLeagueProfile } from '~/models/profile/league.server';
import type { ProfileSummary } from '~/models/profile/summary.server';
import { RANK_COLORS, isLeagueName } from '~/utils/constants';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getLeagueProfile(userId) });
};

const record = (wins: number, losses: number, ties: number) =>
  `${wins}-${losses}-${ties}`;

const pct = (value: number) => value.toFixed(3).replace(/^0/, '');

function LeagueChip({ name }: { name: string }) {
  const key = name.toLocaleLowerCase();
  return (
    <span
      className={clsx(
        'rounded px-1.5 py-0.5 text-xs font-medium',
        isLeagueName(key) ? RANK_COLORS[key] : 'bg-slate-700 text-slate-100',
      )}
    >
      {name}
    </span>
  );
}

export default function MemberLeague() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='in the redraft league'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Highlights profile={profile} />
      <CareerByTier tiers={profile.byTier} />
      <SeasonHistory seasons={profile.seasons} />
      <HeadToHead rows={profile.headToHead} />
      <GameLog games={profile.gameLog} />
    </div>
  );
}

function Highlights({
  profile,
}: {
  profile: ReturnType<typeof useTypedLoaderData<typeof loader>>['profile'];
}) {
  const { highlights, playoffs, career } = profile;
  const { bestWeek, worstWeek } = highlights;

  // Only members who have actually been in the sacko bracket get the stat - it
  // is a separate record from the playoffs on purpose.
  const showSacko = playoffs.sackoAppearances > 0 || playoffs.sackos > 0;

  return (
    <ProfileSection title='Career'>
      {/* One card per topic, each led by the number that sums it up, rather
          than a tile per number. Eight equal tiles wrapped onto a second line
          at most widths and gave the eye nowhere to start. */}
      <div className='grid gap-3 md:grid-cols-3'>
        <CareerCard
          title='Regular Season'
          lead={
            <WinLoss
              wins={career.wins}
              losses={career.losses}
              ties={career.ties}
            />
          }
          leadNote={`${pct(career.winPct)} head to head`}
          meter={
            <SplitBar
              wins={career.wins}
              losses={career.losses}
              ties={career.ties}
            />
          }
        >
          <MiniStat
            label='Median'
            value={
              career.hasAnyMedianSeason ? (
                <WinLoss
                  wins={career.medianWins}
                  losses={career.medianLosses}
                  ties={career.medianTies}
                />
              ) : (
                '—'
              )
            }
          />
          <MiniStat
            label='Win Streak'
            value={highlights.longestWinStreak}
            unit='W'
            tone='text-emerald-300'
          />
          <MiniStat
            label='Skid'
            value={highlights.longestLossStreak}
            unit='L'
            tone='text-rose-300'
          />
        </CareerCard>

        <CareerCard
          title='Scoring'
          lead={highlights.averagePointsPerGame.toFixed(1)}
          leadNote='points per game'
          meter={
            bestWeek &&
            worstWeek && (
              <RangeBar
                low={worstWeek.points}
                high={bestWeek.points}
                mark={highlights.averagePointsPerGame}
              />
            )
          }
        >
          <MiniStat
            label='Worst Week'
            value={worstWeek ? worstWeek.points.toFixed(2) : '—'}
            tone='text-rose-300'
            detail={worstWeek && `${worstWeek.year}, Wk ${worstWeek.week}`}
          />
          <MiniStat
            label='Best Week'
            value={bestWeek ? bestWeek.points.toFixed(2) : '—'}
            tone='text-emerald-300'
            detail={bestWeek && `${bestWeek.year}, Wk ${bestWeek.week}`}
          />
        </CareerCard>

        <CareerCard
          title='Postseason'
          lead={<WinLoss wins={playoffs.wins} losses={playoffs.losses} />}
          leadNote={
            playoffs.championships > 0
              ? `🏆 ${plural(playoffs.championships, 'title')}`
              : 'playoff record'
          }
          meter={<SplitBar wins={playoffs.wins} losses={playoffs.losses} />}
        >
          <MiniStat label='Playoff Berths' value={playoffs.appearances} />
          {showSacko && (
            <MiniStat
              label='Sacko Bracket'
              value={
                <WinLoss
                  wins={playoffs.sackoWins}
                  losses={playoffs.sackoLosses}
                />
              }
              tone={playoffs.sackos > 0 ? 'text-brown' : undefined}
              detail={
                playoffs.sackos > 0
                  ? `💩 ${plural(playoffs.sackos, 'sacko')}`
                  : '0 sackos'
              }
            />
          )}
        </CareerCard>
      </div>
    </ProfileSection>
  );
}

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

/**
 * A W-L(-T) record with the dashes knocked back, so the numbers carry the
 * weight at display sizes. Ties are left off when there are none to show.
 */
function WinLoss({
  wins,
  losses,
  ties,
}: {
  wins: number;
  losses: number;
  ties?: number;
}) {
  const parts = ties ? [wins, losses, ties] : [wins, losses];
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && (
            <span className='mx-0.5 font-normal text-slate-500'>–</span>
          )}
          {part}
        </span>
      ))}
    </>
  );
}

function CareerCard({
  title,
  lead,
  leadNote,
  meter,
  children,
}: {
  title: string;
  lead: ReactNode;
  leadNote: string;
  /** A full-width bar under the headline, so a wide card is not mostly air. */
  meter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className='rounded-md bg-slate-900/50 p-4'>
      <h4 className='m-0 text-sm font-semibold text-slate-300'>{title}</h4>
      <div className='mt-2 text-3xl font-bold leading-none text-white tabular-nums'>
        {lead}
      </div>
      <div className='mt-1.5 text-sm text-slate-400'>{leadNote}</div>
      {/* Flowed from the top rather than pinned to the bottom. The headlines
          are all the same height, so the bars and stat labels line up across
          cards; pinning to the bottom misaligned them whenever one card's small
          stats had a detail line and another's did not. */}
      <div className='mt-5'>
        {meter}
        <dl className='m-0 mt-4 grid auto-cols-fr grid-flow-col gap-4'>
          {children}
        </dl>
      </div>
    </div>
  );
}

/** Wins against losses (and ties) as one bar, in proportion. */
function SplitBar({
  wins,
  losses,
  ties = 0,
}: {
  wins: number;
  losses: number;
  ties?: number;
}) {
  const total = wins + losses + ties;
  const segments = [
    { value: wins, className: 'bg-emerald-400' },
    { value: ties, className: 'bg-slate-400' },
    { value: losses, className: 'bg-rose-400' },
  ];

  return (
    <div
      aria-hidden='true'
      className='flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-700'
    >
      {total > 0 &&
        segments
          .filter(segment => segment.value > 0)
          .map(segment => (
            <div
              key={segment.className}
              className={segment.className}
              style={{ width: `${(segment.value / total) * 100}%` }}
            />
          ))}
    </div>
  );
}

/**
 * Worst week to best week as a track, with the average marked on it - how far
 * a typical week sits from the floor and the ceiling.
 */
function RangeBar({
  low,
  high,
  mark,
}: {
  low: number;
  high: number;
  mark: number;
}) {
  const position = high > low ? ((mark - low) / (high - low)) * 100 : 50;

  return (
    <div
      aria-hidden='true'
      className='relative h-2 rounded-full bg-gradient-to-r from-rose-400/80 via-slate-500 to-emerald-400/80'
    >
      <div
        className='absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow'
        style={{ left: `${position}%` }}
      />
    </div>
  );
}

function MiniStat({
  label,
  value,
  unit,
  detail,
  tone = 'text-slate-100',
}: {
  label: string;
  value: ReactNode;
  /** Trails the value in small type, e.g. the W on a streak. */
  unit?: string;
  /** Trails the value in muted type, e.g. which week a best score came in. */
  detail?: string | null;
  tone?: string;
}) {
  return (
    <div className='flex flex-col'>
      <dt className='text-xs text-slate-400'>{label}</dt>
      <dd className={clsx('m-0 mt-0.5 text-xl font-bold tabular-nums', tone)}>
        {value}
        {unit && (
          <span className='ml-0.5 text-xs font-semibold text-slate-400'>
            {unit}
          </span>
        )}
        {/* Inline rather than on a line of its own, so every small stat is the
            same height and the cards stay level. */}
        {detail && (
          <span className='ml-2 text-xs font-normal text-slate-500'>
            {detail}
          </span>
        )}
      </dd>
    </div>
  );
}

function CareerByTier({ tiers }: { tiers: TierRecord[] }) {
  return (
    <ProfileSection title='Career by Tier'>
      <ProfileTable
        headers={['Tier', 'Seasons', 'Record', 'Win %', 'PF', 'PA']}
        numericColumns={[1, 2, 3, 4, 5]}
      >
        {tiers.map(tier => (
          <tr key={tier.tier} className='border-b border-slate-700/70'>
            <td className='px-2 py-2 font-medium'>{tier.label}</td>
            <td className='px-2 py-2 text-right'>{tier.seasons}</td>
            <td className='px-2 py-2 text-right'>
              {record(tier.wins, tier.losses, tier.ties)}
            </td>
            <td className='px-2 py-2 text-right'>{pct(tier.winPct)}</td>
            <td className='px-2 py-2 text-right'>
              {tier.pointsFor.toFixed(1)}
            </td>
            <td className='px-2 py-2 text-right'>
              {tier.pointsAgainst.toFixed(1)}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

function SeasonHistory({ seasons }: { seasons: SeasonRow[] }) {
  const anyMedian = seasons.some(season => season.hasMedianScoring);

  // Year, League and Finish read as words; everything after them is a number.
  const firstNumeric = 3;
  const columns = [
    'Year',
    'League',
    'Finish',
    'H2H',
    ...(anyMedian ? ['Median'] : []),
    'Total',
    'Playoffs',
    'PF Rank',
    'PF',
    'PA',
    'Draft',
  ];

  const totals = seasons.reduce(
    (sum, season) => ({
      wins: sum.wins + season.wins,
      losses: sum.losses + season.losses,
      ties: sum.ties + season.ties,
      medianWins: sum.medianWins + season.medianWins,
      medianLosses: sum.medianLosses + season.medianLosses,
      medianTies: sum.medianTies + season.medianTies,
      totalWins: sum.totalWins + season.totalWins,
      totalLosses: sum.totalLosses + season.totalLosses,
      totalTies: sum.totalTies + season.totalTies,
      // Playoff-bracket seasons only. Adding the sacko bracket in would give a
      // postseason total that matches neither record in the Career section.
      playoffWins:
        sum.playoffWins +
        (season.playoffBracket === 'WINNERS' ? season.playoffWins : 0),
      playoffLosses:
        sum.playoffLosses +
        (season.playoffBracket === 'WINNERS' ? season.playoffLosses : 0),
      pointsFor: sum.pointsFor + season.pointsFor,
      pointsAgainst: sum.pointsAgainst + season.pointsAgainst,
    }),
    {
      wins: 0,
      losses: 0,
      ties: 0,
      medianWins: 0,
      medianLosses: 0,
      medianTies: 0,
      totalWins: 0,
      totalLosses: 0,
      totalTies: 0,
      playoffWins: 0,
      playoffLosses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    },
  );

  return (
    <ProfileSection title='Season History'>
      <ProfileTable
        headers={columns}
        numericColumns={columns
          .map((_, index) => index)
          .filter(index => index >= firstNumeric)}
        footer={
          <tr>
            <td className='px-2 py-2' colSpan={3}>
              {seasons.length} seasons
            </td>
            <td className='px-2 py-2 text-right'>
              {record(totals.wins, totals.losses, totals.ties)}
            </td>
            {anyMedian && (
              <td className='px-2 py-2 text-right'>
                {record(
                  totals.medianWins,
                  totals.medianLosses,
                  totals.medianTies,
                )}
              </td>
            )}
            <td className='px-2 py-2 text-right'>
              {record(totals.totalWins, totals.totalLosses, totals.totalTies)}
            </td>
            <td className='px-2 py-2 text-right'>
              {totals.playoffWins}-{totals.playoffLosses}
            </td>
            {/* A rank is not a thing you can add up. */}
            <td />
            <td className='px-2 py-2 text-right'>
              {totals.pointsFor.toFixed(1)}
            </td>
            <td className='px-2 py-2 text-right'>
              {totals.pointsAgainst.toFixed(1)}
            </td>
            <td />
          </tr>
        }
      >
        {seasons.map(season => (
          <tr key={season.leagueId} className='border-b border-slate-700/70'>
            <td className='px-2 py-2'>{season.year}</td>
            <td className='px-2 py-2'>
              <LeagueChip name={season.leagueName} />
            </td>
            <td className='px-2 py-2'>
              <Finish season={season} />
            </td>
            <td className='px-2 py-2 text-right'>
              {record(season.wins, season.losses, season.ties)}
            </td>
            {anyMedian && (
              <td className='px-2 py-2 text-right'>
                {season.hasMedianScoring
                  ? record(
                      season.medianWins,
                      season.medianLosses,
                      season.medianTies,
                    )
                  : '—'}
              </td>
            )}
            <td className='px-2 py-2 text-right text-slate-400'>
              {record(season.totalWins, season.totalLosses, season.totalTies)}
            </td>
            <td className='px-2 py-2 text-right'>
              {season.playoffBracket ? (
                <span
                  className={
                    season.playoffBracket === 'LOSERS'
                      ? 'text-rose-300'
                      : undefined
                  }
                >
                  {season.playoffWins}-{season.playoffLosses}
                </span>
              ) : (
                '—'
              )}
            </td>
            <td className='px-2 py-2 text-right'>
              {season.pointsForRank ?? '—'}
            </td>
            <td className='px-2 py-2 text-right'>
              {season.pointsFor.toFixed(1)}
            </td>
            <td className='px-2 py-2 text-right'>
              {season.pointsAgainst.toFixed(1)}
            </td>
            <td className='px-2 py-2 text-right'>
              {season.draftPosition ?? '—'}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

/**
 * Where a season actually ended, from the postseason brackets rather than the
 * regular-season table - a champion who was the four seed finished first.
 */
function Finish({ season }: { season: SeasonRow }) {
  if (!season.finish) return <span className='text-slate-500'>—</span>;

  // The two ends of the table are the ones worth spotting from across the page.
  const { tone, emoji } =
    season.finish === 'Champion'
      ? { tone: 'text-gold font-medium', emoji: '🏆' }
      : season.finish === 'Sacko'
      ? { tone: 'text-brown font-medium', emoji: '💩' }
      : season.finish === 'Sacko Finalist'
      ? { tone: 'text-brown', emoji: null }
      : season.place !== null && season.place <= 6
      ? { tone: 'text-slate-100', emoji: null }
      : { tone: 'text-slate-400', emoji: null };

  return (
    <span className={clsx('inline-flex items-center gap-1', tone)}>
      {emoji && <span aria-hidden='true'>{emoji}</span>}
      {season.finish}
    </span>
  );
}

const MEETING_TONE: Record<
  HeadToHeadRow['meetings'][number]['result'],
  string
> = {
  W: 'text-green-400',
  L: 'text-red-400',
  T: 'text-slate-400',
};

/**
 * "2020 (W2, W13) \u00b7 2021 (W7, W16)" - weeks collected under their season,
 * each coloured by how that meeting went.
 */
function MeetingsByYear({ meetings }: { meetings: HeadToHeadRow['meetings'] }) {
  const byYear = new Map<number, HeadToHeadRow['meetings']>();
  for (const meeting of meetings) {
    const games = byYear.get(meeting.year);
    if (games) games.push(meeting);
    else byYear.set(meeting.year, [meeting]);
  }

  return (
    <>
      {Array.from(byYear.entries()).map(([year, games], i) => (
        <Fragment key={year}>
          {i > 0 && ' \u00b7 '}
          {year} (
          {games.map((game, j) => (
            <Fragment key={game.week}>
              {j > 0 && ', '}
              <span
                className={MEETING_TONE[game.result]}
                title={
                  game.result === 'W'
                    ? 'Win'
                    : game.result === 'L'
                    ? 'Loss'
                    : 'Tie'
                }
              >
                W{game.week}
              </span>
            </Fragment>
          ))}
          )
        </Fragment>
      ))}
    </>
  );
}

function HeadToHead({ rows }: { rows: HeadToHeadRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, 15);

  if (rows.length === 0) return null;

  return (
    <ProfileSection title='Head to Head'>
      <ProfileTable
        headers={['Opponent', 'Record', 'Meetings', 'When']}
        numericColumns={[1, 2]}
      >
        {visible.map(row => (
          <tr key={row.opponentUserId} className='border-b border-slate-700/70'>
            <td className='px-2 py-2'>
              <Link to={`/members/${row.opponentUserId}/league`}>
                {row.opponentName}
              </Link>
            </td>
            <td className='px-2 py-2 text-right'>
              {record(row.wins, row.losses, row.ties)}
            </td>
            <td className='px-2 py-2 text-right'>{row.meetingCount}</td>
            <td className='px-2 py-2 text-xs text-slate-400'>
              <MeetingsByYear meetings={row.meetings} />
            </td>
          </tr>
        ))}
      </ProfileTable>
      {rows.length > 15 && (
        <button
          type='button'
          onClick={() => setShowAll(value => !value)}
          className='mt-3 text-sm text-slate-300 underline'
        >
          {showAll ? 'Show fewer' : `Show all ${rows.length} opponents`}
        </button>
      )}
    </ProfileSection>
  );
}

/**
 * Which postseason a game belonged to.
 *
 * Every team plays in one of the two brackets, so a week past the regular
 * season is either a playoff game or a sacko one - "P" said neither. A
 * postseason game with no bracket is a season Sleeper has not finished yet.
 */
function PostseasonTag({ game }: { game: GameLogRow }) {
  if (game.isRegularSeason) return null;

  const [label, tone] =
    game.postseasonBracket === 'WINNERS'
      ? ['Playoff', 'bg-amber-400/15 text-amber-300']
      : game.postseasonBracket === 'LOSERS'
      ? ['Sacko', 'bg-rose-400/15 text-rose-300']
      : ['Post', 'bg-slate-600/40 text-slate-300'];

  return (
    <span className={clsx('rounded px-1.5 py-0.5 text-xs', tone)}>{label}</span>
  );
}

function GameLog({ games }: { games: GameLogRow[] }) {
  const years = Array.from(new Set(games.map(game => game.year))).sort(
    (a, b) => b - a,
  );
  const [year, setYear] = useState<number | 'all'>(years[0] ?? 'all');

  const visible = year === 'all' ? games : games.filter(g => g.year === year);

  return (
    <ProfileSection
      title='Game Log'
      action={
        <div className='flex flex-wrap gap-1'>
          {[...years, 'all' as const].map(option => (
            <button
              key={option}
              type='button'
              onClick={() => setYear(option)}
              className={clsx(
                'rounded px-2.5 py-1 text-sm',
                year === option
                  ? 'bg-white font-medium text-slate-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
              )}
            >
              {option === 'all' ? 'All' : option}
            </button>
          ))}
        </div>
      }
    >
      <ProfileTable
        headers={['Year', 'Wk', '', 'League', 'Opponent', 'Score', 'Result']}
        numericColumns={[1, 5]}
      >
        {visible.map(game => (
          <tr
            key={`${game.year}-${game.week}-${
              game.opponentUserId ?? game.opponentName
            }`}
            className='border-b border-slate-700/70'
          >
            <td className='px-2 py-2'>{game.year}</td>
            <td className='px-2 py-2 text-right'>{game.week}</td>
            <td className='py-2 pr-2'>
              <PostseasonTag game={game} />
            </td>
            <td className='px-2 py-2'>
              <LeagueChip name={game.leagueName} />
            </td>
            <td className='px-2 py-2'>
              {game.opponentUserId ? (
                <Link to={`/members/${game.opponentUserId}/league`}>
                  {game.opponentName}
                </Link>
              ) : (
                game.opponentName
              )}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {game.pointsScored.toFixed(2)} &ndash;{' '}
              {game.opponentPoints.toFixed(2)}
            </td>
            <td className='px-2 py-2'>
              <span
                className={clsx(
                  'font-bold',
                  game.result === 'W'
                    ? 'text-green-400'
                    : game.result === 'L'
                    ? 'text-red-400'
                    : 'text-slate-400',
                )}
              >
                {game.result}
              </span>
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}
