import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import StatTile from '~/components/layout/profile/StatTile';
import type {
  GameLogRow,
  HeadToHeadRow,
  SeasonRow,
  TierRecord,
} from '~/models/profile/league.server';
import { getLeagueProfile } from '~/models/profile/league.server';
import type { ProfileSummary } from '~/models/profile/summary.server';
import { authenticator } from '~/services/auth.server';
import { RANK_COLORS, isLeagueName } from '~/utils/constants';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, { failureRedirect: '/login' });

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
        isLeagueName(key) ? RANK_COLORS[key] : 'bg-gray-700 text-gray-100',
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

  return (
    <section>
      <h3>Career</h3>
      <div className='not-prose grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6'>
        <StatTile
          label='Playoff Record'
          value={`${playoffs.wins}-${playoffs.losses}`}
        />
        <StatTile
          label='Playoff Berths'
          value={playoffs.appearances.toString()}
        />
        <StatTile
          label='Avg Points'
          value={highlights.averagePointsPerGame.toFixed(1)}
        />
        <StatTile
          label='Best Week'
          value={
            highlights.bestWeek ? highlights.bestWeek.points.toFixed(1) : '—'
          }
        />
        <StatTile
          label='Longest Win Streak'
          value={highlights.longestWinStreak.toString()}
        />
        <StatTile
          label='Median Record'
          value={
            career.hasAnyMedianSeason
              ? record(
                  career.medianWins,
                  career.medianLosses,
                  career.medianTies,
                )
              : '—'
          }
        />
        {/* Only shown for members who have actually been in the sacko bracket -
            it is a separate record from the playoffs on purpose. */}
        {playoffs.sackoAppearances > 0 && (
          <StatTile
            label='Sacko Bracket'
            value={`${playoffs.sackoWins}-${playoffs.sackoLosses}`}
          />
        )}
        {playoffs.sackos > 0 && (
          <StatTile label='Sackos' value={playoffs.sackos.toString()} />
        )}
      </div>
      {highlights.bestWeek && highlights.worstWeek && (
        <p className='mt-2 text-sm text-gray-400'>
          Best: {highlights.bestWeek.points.toFixed(2)} in{' '}
          {highlights.bestWeek.year} week {highlights.bestWeek.week} · Worst:{' '}
          {highlights.worstWeek.points.toFixed(2)} in{' '}
          {highlights.worstWeek.year} week {highlights.worstWeek.week}
        </p>
      )}
    </section>
  );
}

function CareerByTier({ tiers }: { tiers: TierRecord[] }) {
  return (
    <section>
      <h3>Career by League</h3>
      <ProfileTable
        headers={['League', 'Seasons', 'Record', 'Win %', 'PF', 'PA']}
        numericColumns={[1, 2, 3, 4, 5]}
      >
        {tiers.map(tier => (
          <tr key={tier.tier} className='border-b border-gray-800'>
            <td className='px-2 py-2'>
              <LeagueChip name={tier.leagueName} />
            </td>
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
    </section>
  );
}

/** Tiers are numbered with 1 at the top, so a fall in number is a promotion. */
function TierMove({ change }: { change: number | null }) {
  if (change === null || change === 0) return null;

  const promoted = change < 0;
  return (
    <span
      className={promoted ? 'text-green-400' : 'text-red-400'}
      title={promoted ? 'Promoted' : 'Relegated'}
    >
      {promoted ? '▲' : '▼'}
    </span>
  );
}

function SeasonHistory({ seasons }: { seasons: SeasonRow[] }) {
  const anyMedian = seasons.some(season => season.hasMedianScoring);

  return (
    <section>
      <h3>Season History</h3>
      <ProfileTable
        headers={[
          'Year',
          'League',
          'Finish',
          'Record',
          ...(anyMedian ? ['Median'] : []),
          'PF',
          'PA',
          'Draft',
        ]}
        numericColumns={anyMedian ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6]}
      >
        {seasons.map(season => (
          <tr key={season.leagueId} className='border-b border-gray-800'>
            <td className='px-2 py-2'>{season.year}</td>
            <td className='px-2 py-2'>
              <span className='inline-flex items-center gap-1'>
                <LeagueChip name={season.leagueName} />
                <TierMove change={season.tierChange} />
              </span>
            </td>
            <td className='px-2 py-2 text-right'>
              {season.rank ? `${season.rank} / ${season.teamCount}` : '—'}
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
      {anyMedian && (
        <p className='mt-2 text-xs text-gray-500'>
          Median games began partway through the league&rsquo;s history. Seasons
          played before then show a dash rather than a zero.
        </p>
      )}
    </section>
  );
}

function HeadToHead({ rows }: { rows: HeadToHeadRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? rows : rows.slice(0, 15);

  if (rows.length === 0) return null;

  return (
    <section>
      <h3>Head to Head</h3>
      <ProfileTable
        headers={['Opponent', 'Record', 'Meetings', 'PF', 'PA', 'Seasons']}
        numericColumns={[1, 2, 3, 4]}
      >
        {visible.map(row => (
          <tr key={row.opponentUserId} className='border-b border-gray-800'>
            <td className='px-2 py-2'>
              <Link to={`/members/${row.opponentUserId}/league`}>
                {row.opponentName}
              </Link>
            </td>
            <td className='px-2 py-2 text-right'>
              {record(row.wins, row.losses, row.ties)}
            </td>
            <td className='px-2 py-2 text-right'>{row.meetings}</td>
            <td className='px-2 py-2 text-right'>{row.pointsFor.toFixed(1)}</td>
            <td className='px-2 py-2 text-right'>
              {row.pointsAgainst.toFixed(1)}
            </td>
            <td className='px-2 py-2 text-xs text-gray-400'>
              {row.years.join(', ')}
            </td>
          </tr>
        ))}
      </ProfileTable>
      {rows.length > 15 && (
        <button
          type='button'
          onClick={() => setShowAll(value => !value)}
          className='mt-2 text-sm text-gray-400 underline'
        >
          {showAll ? 'Show fewer' : `Show all ${rows.length} opponents`}
        </button>
      )}
    </section>
  );
}

function GameLog({ games }: { games: GameLogRow[] }) {
  const years = Array.from(new Set(games.map(game => game.year))).sort(
    (a, b) => b - a,
  );
  const [year, setYear] = useState<number | 'all'>(years[0] ?? 'all');

  const visible = year === 'all' ? games : games.filter(g => g.year === year);

  return (
    <section>
      <h3>Game Log</h3>
      <div className='not-prose mb-3 flex flex-wrap gap-1'>
        {[...years, 'all' as const].map(option => (
          <button
            key={option}
            type='button'
            onClick={() => setYear(option)}
            className={clsx(
              'rounded px-2.5 py-1 text-sm',
              year === option
                ? 'bg-white text-gray-900'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
            )}
          >
            {option === 'all' ? 'All' : option}
          </button>
        ))}
      </div>
      <ProfileTable
        headers={['Year', 'Wk', 'League', 'Opponent', 'Score', 'Result']}
        numericColumns={[1, 4]}
      >
        {visible.map(game => (
          <tr
            key={`${game.year}-${game.week}-${
              game.opponentUserId ?? game.opponentName
            }`}
            className='border-b border-gray-800'
          >
            <td className='px-2 py-2'>{game.year}</td>
            <td className='px-2 py-2 text-right'>
              {game.week}
              {!game.isRegularSeason && (
                <span
                  className='ml-1 text-xs text-amber-400'
                  title='Postseason'
                >
                  P
                </span>
              )}
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
                    : 'text-gray-400',
                )}
              >
                {game.result}
              </span>
            </td>
          </tr>
        ))}
      </ProfileTable>
    </section>
  );
}
