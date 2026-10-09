import type { LoaderFunctionArgs } from '@remix-run/node';
import { useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { Fragment, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import LeadContext from '~/components/layout/profile/LeadContext';
import LeagueChip from '~/components/layout/profile/LeagueChip';
import ProfileLink from '~/components/layout/profile/ProfileLink';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable, {
  MobileCard,
  MobileCards,
} from '~/components/layout/profile/ProfileTable';
import RangeBar from '~/components/layout/profile/RangeBar';
import ShowAllButton from '~/components/layout/profile/ShowAllButton';
import SplitBar from '~/components/layout/profile/SplitBar';
import Tag, { CurrentTag } from '~/components/layout/profile/Tag';
import WinLoss from '~/components/layout/profile/WinLoss';
import YearFilter from '~/components/layout/profile/YearFilter';
import {
  ordinal,
  pct,
  plural,
  weekLabel,
} from '~/components/layout/profile/format';
import { RESULT_TEXT, TEXT } from '~/components/layout/profile/tones';
import type { TagTone } from '~/components/layout/profile/tones';
import { requireProfileMember } from '~/models/profile/access.server';
import type {
  GameLogRow,
  HeadToHeadRow,
  SeasonRow,
  TierRecord,
} from '~/models/profile/league.server';
import { getLeagueProfile } from '~/models/profile/league.server';
import type { ProfileSummary } from '~/models/profile/summary.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const userId = await requireProfileMember(request, params.handle);

  return typedjson({ profile: await getLeagueProfile(userId) });
};

const record = (wins: number, losses: number, ties: number) =>
  `${wins}-${losses}-${ties}`;

export default function MemberLeague() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState
        contest='the redraft league'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Highlights profile={profile} />
      <SeasonHistory seasons={profile.seasons} />
      <CareerByTier tiers={profile.byTier} />
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
            <>
              <WinLoss
                wins={career.wins}
                losses={career.losses}
                ties={career.ties}
              />
              <LeadContext>{pct(career.winPct, 1)}</LeadContext>
            </>
          }
          meter={
            <SplitBar
              wins={career.wins}
              losses={career.losses}
              ties={career.ties}
            />
          }
        >
          {/* The lead is the total record, so the split only says anything
              once a median season has been folded into it. */}
          {career.hasAnyMedianSeason && (
            <MiniStat
              label='H2H'
              info='Head to head: their record against the team they played each week.'
              value={
                <WinLoss
                  wins={career.h2hWins}
                  losses={career.h2hLosses}
                  ties={career.h2hTies}
                />
              }
            />
          )}
          <MiniStat
            label='Median'
            info='Their record against the league median score each week, in the seasons that counted it as a second game.'
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
          lead={
            <>
              {highlights.averagePointsPerGame.toFixed(1)}
              <LeadContext>weekly average</LeadContext>
            </>
          }
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
            detail={worstWeek && weekLabel(worstWeek)}
          />
          <MiniStat
            label='Best Week'
            value={bestWeek ? bestWeek.points.toFixed(2) : '—'}
            tone='text-emerald-300'
            detail={bestWeek && weekLabel(bestWeek)}
          />
        </CareerCard>

        <CareerCard
          title='Postseason'
          lead={
            <>
              <WinLoss wins={playoffs.wins} losses={playoffs.losses} />
              {playoffs.championships > 0 && (
                <LeadContext>
                  🏆 {plural(playoffs.championships, 'league championship')}
                </LeadContext>
              )}
            </>
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
              tone={playoffs.sackos > 0 ? TEXT.sacko : undefined}
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

function CareerByTier({ tiers }: { tiers: TierRecord[] }) {
  return (
    <ProfileSection title='Career by Tier'>
      <ProfileTable
        headers={[
          'Tier',
          'Seasons',
          'Record',
          'Win %',
          'PF',
          'PF/Season',
          'PA',
          'PA/Season',
        ]}
        primaryColumns={[2, 3]}
        numericColumns={[1, 2, 3, 4, 5, 6, 7]}
      >
        {tiers.map(tier => (
          <tr key={tier.tier} className='border-b border-slate-700/70'>
            <td className='px-2 py-2 font-medium'>{tier.label}</td>
            <td className='px-2 py-2 text-right'>{tier.seasons}</td>
            <td className='px-2 py-2 text-right'>
              {record(tier.wins, tier.losses, tier.ties)}
            </td>
            <td className='px-2 py-2 text-right'>{pct(tier.winPct, 1)}</td>
            <td className='px-2 py-2 text-right'>
              {tier.pointsFor.toFixed(1)}
            </td>
            <td className='px-2 py-2 text-right'>
              <PerSeason value={tier.pointsForPerSeason} />
            </td>
            <td className='px-2 py-2 text-right'>
              {tier.pointsAgainst.toFixed(1)}
            </td>
            <td className='px-2 py-2 text-right'>
              <PerSeason value={tier.pointsAgainstPerSeason} />
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

/**
 * A per-season average, which only counts finished seasons - one a few weeks
 * old would drag it down to a fraction of a real one.
 */
function PerSeason({ value }: { value: number | null }) {
  return value === null ? (
    <span className='text-slate-400'>—</span>
  ) : (
    <>{value.toFixed(1)}</>
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
    'Record',
    // Only worth splitting out once a median season makes the two differ.
    ...(anyMedian ? ['H2H', 'Median'] : []),
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
    <ProfileSection title='By Season'>
      <ProfileTable
        headers={columns}
        numericColumns={columns
          .map((_, index) => index)
          .filter(index => index >= firstNumeric)}
        // Finish and the total record; the rest open from each row.
        primaryColumns={[2, 3]}
        footer={
          // A cell per column rather than one spanning three, so a phone
          // hiding the League column hides the right cell in this row too.
          <tr>
            <td className='whitespace-nowrap px-2 py-2'>
              {plural(seasons.length, 'season')}
            </td>
            <td />
            <td />
            <td className='px-2 py-2 text-right'>
              {record(totals.totalWins, totals.totalLosses, totals.totalTies)}
            </td>
            {anyMedian && (
              <>
                <td className='px-2 py-2 text-right'>
                  {record(totals.wins, totals.losses, totals.ties)}
                </td>
                <td className='px-2 py-2 text-right'>
                  {record(
                    totals.medianWins,
                    totals.medianLosses,
                    totals.medianTies,
                  )}
                </td>
              </>
            )}
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
            <td className='whitespace-nowrap px-2 py-2'>
              {season.year}
              {season.inProgress && <CurrentTag />}
            </td>
            <td className='px-2 py-2'>
              <LeagueChip name={season.leagueName} />
            </td>
            <td className='px-2 py-2'>
              <Finish season={season} />
            </td>
            <td className='px-2 py-2 text-right'>
              {record(season.totalWins, season.totalLosses, season.totalTies)}
            </td>
            {anyMedian && (
              <>
                <td className='px-2 py-2 text-right text-slate-400'>
                  {record(season.wins, season.losses, season.ties)}
                </td>
                <td className='px-2 py-2 text-right text-slate-400'>
                  {season.hasMedianScoring
                    ? record(
                        season.medianWins,
                        season.medianLosses,
                        season.medianTies,
                      )
                    : '—'}
                </td>
              </>
            )}
            <td className='whitespace-nowrap px-2 py-2 text-right'>
              {season.playoffBracket ? (
                <span
                  className={
                    season.playoffBracket === 'LOSERS' ? TEXT.bad : undefined
                  }
                >
                  {/* Named as well as coloured: the sacko bracket's record
                      is not a playoff run. */}
                  {season.playoffBracket === 'LOSERS' && (
                    <span className='mr-1.5 text-xs text-slate-400'>Sacko</span>
                  )}
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
 * While a season is being played, where they stand in the table instead.
 */
function Finish({ season }: { season: SeasonRow }) {
  // A season still being played has no finish yet, only a place in the table.
  if (season.standing && !season.finish) {
    return (
      <span className={clsx('whitespace-nowrap', TEXT.live)}>
        {ordinal(season.standing.place)}
        <span className='text-slate-400'> of {season.standing.fieldSize}</span>
      </span>
    );
  }

  if (!season.finish) return <span className='text-slate-400'>—</span>;

  // The two ends of the table are the ones worth spotting from across the page.
  const { tone, emoji } =
    season.finish === 'Champion'
      ? { tone: 'text-gold font-medium', emoji: '🏆' }
      : season.finish === 'Sacko'
      ? { tone: 'text-brown-light font-medium', emoji: '💩' }
      : season.finish === 'Sacko Finalist'
      ? { tone: TEXT.sacko, emoji: null }
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

/**
 * "2020: week 2 W, week 13 L; 2021: week 7 W" - each meeting under its
 * season, with how it went as a letter as well as a colour.
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
          {i > 0 && '; '}
          {year}:{' '}
          {games.map((game, j) => (
            <Fragment key={game.week}>
              {j > 0 && ', '}
              <span className='whitespace-nowrap'>
                week {game.week}{' '}
                <span
                  className={clsx('font-semibold', RESULT_TEXT[game.result])}
                  title={RESULT_WORD[game.result]}
                >
                  {game.result}
                </span>
              </span>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </>
  );
}

const RESULT_WORD = { W: 'Win', L: 'Loss', T: 'Tie' } as const;

function HeadToHead({ rows }: { rows: HeadToHeadRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, 15);

  if (rows.length === 0) return null;

  return (
    <ProfileSection title='Head to Head'>
      <ProfileTable
        headers={['Opponent', 'Record', 'Meetings', 'When']}
        numericColumns={[1, 2]}
        mobileCards={
          <MobileCards>
            {visible.map(row => (
              <MobileCard
                key={row.opponentUserId}
                title={
                  <ProfileLink userId={row.opponentUserId}>
                    {row.opponentName}
                  </ProfileLink>
                }
                subtitle={plural(row.meetingCount, 'meeting')}
                value={record(row.wins, row.losses, row.ties)}
              >
                <div className='text-xs leading-relaxed text-slate-400'>
                  <MeetingsByYear meetings={row.meetings} />
                </div>
              </MobileCard>
            ))}
          </MobileCards>
        }
      >
        {visible.map(row => (
          <tr key={row.opponentUserId} className='border-b border-slate-700/70'>
            <td className='px-2 py-2'>
              <ProfileLink userId={row.opponentUserId}>
                {row.opponentName}
              </ProfileLink>
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
        <ShowAllButton
          total={rows.length}
          noun='opponents'
          showAll={showAll}
          onToggle={() => setShowAll(value => !value)}
        />
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

  const [label, tone]: [string, TagTone] =
    game.postseasonBracket === 'WINNERS'
      ? ['Playoff', 'highlight']
      : game.postseasonBracket === 'LOSERS'
      ? ['Sacko', 'loss']
      : ['Post', 'neutral'];

  return <Tag tone={tone}>{label}</Tag>;
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
      action={<YearFilter years={years} value={year} onChange={setYear} />}
    >
      <ProfileTable
        headers={['Year', 'Week', '', 'League', 'Opponent', 'Score', 'Result']}
        numericColumns={[1, 5]}
        mobileCards={
          <MobileCards>
            {visible.map(game => (
              <MobileCard
                key={`${game.year}-${game.week}-${
                  game.opponentUserId ?? game.opponentName
                }`}
                title={
                  <>
                    vs{' '}
                    {game.opponentUserId ? (
                      <ProfileLink userId={game.opponentUserId}>
                        {game.opponentName}
                      </ProfileLink>
                    ) : (
                      game.opponentName
                    )}
                  </>
                }
                subtitle={
                  <span className='inline-flex flex-wrap items-center gap-1.5'>
                    {weekLabel(game)}
                    <LeagueChip name={game.leagueName} />
                    <PostseasonTag game={game} />
                  </span>
                }
                value={
                  <>
                    {game.pointsScored.toFixed(2)} &ndash;{' '}
                    {game.opponentPoints.toFixed(2)}
                  </>
                }
                status={
                  <span
                    className={clsx('font-bold', RESULT_TEXT[game.result])}
                    title={RESULT_WORD[game.result]}
                  >
                    {game.result}
                  </span>
                }
              />
            ))}
          </MobileCards>
        }
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
                <ProfileLink userId={game.opponentUserId}>
                  {game.opponentName}
                </ProfileLink>
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
                className={clsx('font-bold', RESULT_TEXT[game.result])}
                title={RESULT_WORD[game.result]}
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
