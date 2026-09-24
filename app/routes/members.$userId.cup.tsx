import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import LeagueChip from '~/components/layout/profile/LeagueChip';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import SplitBar from '~/components/layout/profile/SplitBar';
import WinLoss from '~/components/layout/profile/WinLoss';
import YearFilter from '~/components/layout/profile/YearFilter';
import { requireProfileAccess } from '~/models/profile/access.server';
import type { CurrentCup } from '~/models/profile/cup.server';
import { getCupProfile } from '~/models/profile/cup.server';
import type {
  CupCareer,
  CupOpponent,
  CupRun,
  MatchLogRow,
  RoundResult,
} from '~/models/profile/cupProfile';
import {
  CUP_ROUNDS,
  ROUNDS_TO_WIN,
  ROUND_LABEL,
  ROUND_SHORT,
} from '~/models/profile/cupProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';
import { RANK_COLORS, isLeagueName } from '~/utils/constants';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getCupProfile(userId) });
};

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const points = (value: number | null) =>
  value === null ? '—' : value.toFixed(2);

/** "+2", "−1", "0" - a proper minus, so the column lines up. */
const signed = (value: number, digits = 0) =>
  value > 0
    ? `+${value.toFixed(digits)}`
    : value < 0
    ? `−${(-value).toFixed(digits)}`
    : (0).toFixed(digits);

export default function MemberCup() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <div className='space-y-8'>
        {profile.current && <CurrentCupBanner current={profile.current} />}
        <ContestEmptyState
          contest='in the Cup'
          memberName={summary.user.discordName}
        />
      </div>
    );
  }

  return (
    <div className='space-y-8'>
      {profile.current && <CurrentCupBanner current={profile.current} />}
      <Career career={profile.career} />
      <BracketRuns runs={profile.runs} />
      <SeedingHistory runs={profile.runs} />
      <MatchLog games={profile.matchLog} />
    </div>
  );
}

function OpponentLink({ opponent }: { opponent: CupOpponent }) {
  return (
    <>
      {opponent.userId ? (
        <Link to={`/members/${opponent.userId}/cup`}>{opponent.name}</Link>
      ) : (
        opponent.name
      )}{' '}
      <span className='text-slate-400'>(#{opponent.seed})</span>
    </>
  );
}

/**
 * This year's Cup while it is still being played: the live seeding table
 * before the bracket exists, and where their run stands once it does.
 */
function CurrentCupBanner({ current }: { current: CurrentCup }) {
  if (current.phase === 'seeding') {
    const onByePace = current.rank <= 4;
    return (
      <Banner title={`${current.year} Cup · Seeding`}>
        <p className='m-0 text-slate-200'>
          Currently{' '}
          <span className='text-xl font-bold text-white tabular-nums'>
            #{current.rank}
          </span>{' '}
          of {current.fieldSize} after {current.weeksPlayed} of{' '}
          {plural(current.seedingWeeks, 'seeding week')} ·{' '}
          <span className='tabular-nums'>{current.points.toFixed(2)}</span> pts
        </p>
        <p className='m-0 mt-1 text-sm text-slate-400'>
          {onByePace
            ? 'On pace for a first-round bye - the top 4 seeds skip the Round of 64.'
            : 'Seeds are set by total points across the seeding weeks; the top 4 get a bye.'}
        </p>
      </Banner>
    );
  }

  const { run } = current;
  const live = run.rounds.find(round => round.status === 'PENDING');

  return (
    <Banner title={`${run.year} Cup · Seed #${run.seed}`}>
      {run.status === 'alive' ? (
        <p className='m-0 text-slate-200'>
          <span className='font-semibold text-emerald-300'>Still alive</span> in
          the {ROUND_LABEL[CUP_ROUNDS[run.depth]]}
          {live?.opponent && (
            <>
              {' '}
              against <OpponentLink opponent={live.opponent} />
            </>
          )}
          {live?.points !== null &&
            live?.points !== undefined &&
            live.opponentPoints !== null && (
              <span className='ml-2 tabular-nums text-slate-400'>
                {live.points.toFixed(2)} – {live.opponentPoints.toFixed(2)}
              </span>
            )}
        </p>
      ) : (
        <p className='m-0 text-slate-200'>
          {run.status === 'champion' ? (
            <span className='font-semibold text-gold'>🏆 Won the Cup</span>
          ) : (
            <>
              <span className='font-semibold text-rose-300'>Knocked out</span>{' '}
              {run.depth >= ROUNDS_TO_WIN - 1
                ? 'in the Final'
                : `in the ${ROUND_LABEL[CUP_ROUNDS[run.depth]]}`}
              {run.eliminatedBy && (
                <>
                  {' '}
                  by <OpponentLink opponent={run.eliminatedBy} />
                </>
              )}
            </>
          )}
        </p>
      )}
    </Banner>
  );
}

function Banner({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className='not-prose rounded-lg border border-amber-400/40 bg-amber-400/5 p-4 md:p-5'>
      <h3 className='m-0 mb-2 text-sm font-semibold uppercase tracking-wide text-amber-300'>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Career({ career }: { career: CupCareer }) {
  const games = career.wins + career.losses;

  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 md:grid-cols-2'>
        <CareerCard
          title='Best Run'
          lead={
            career.bestRun?.depth === ROUNDS_TO_WIN ? (
              <span className='text-gold'>🏆 Champion</span>
            ) : (
              career.bestRun?.finish ?? '—'
            )
          }
          leadNote={
            career.titles > 1
              ? `${plural(career.titles, 'title')}, latest ${
                  career.bestRun?.year
                }`
              : career.bestRun
              ? `${career.bestRun.year}`
              : ''
          }
          meter={<DepthMeter depth={career.bestRun?.depth ?? 0} />}
        >
          <MiniStat
            label='Titles'
            value={career.titles}
            tone={career.titles > 0 ? 'text-gold' : undefined}
          />
          <MiniStat label='Finals' value={career.finals} />
          <MiniStat label='Final Fours' value={career.finalFours} />
        </CareerCard>

        <CareerCard
          title='Cup Record'
          lead={<WinLoss wins={career.wins} losses={career.losses} />}
          leadNote={
            games > 0
              ? `${Math.round((career.wins / games) * 100)}% of cup games won`
              : 'no cup games yet'
          }
          meter={<SplitBar wins={career.wins} losses={career.losses} />}
        >
          <MiniStat label='Byes' value={career.byes} />
          <MiniStat
            label='Beat Higher Seed'
            value={career.upsetsWon}
            tone='text-emerald-300'
          />
          <MiniStat
            label='Lost to Lower Seed'
            value={career.upsetsLost}
            tone='text-rose-300'
          />
        </CareerCard>
      </div>
    </ProfileSection>
  );
}

/** The six rounds as a track, filled as far as their best run got. */
function DepthMeter({ depth }: { depth: number }) {
  return (
    <div aria-hidden='true' className='flex h-2 gap-0.5'>
      {CUP_ROUNDS.map((round, index) => (
        <div
          key={round}
          className={clsx(
            'flex-1 first:rounded-l-full last:rounded-r-full',
            index < depth
              ? depth >= ROUNDS_TO_WIN
                ? 'bg-amber-300'
                : 'bg-emerald-400'
              : 'bg-slate-700',
          )}
        />
      ))}
    </div>
  );
}

function SeedChip({ seed, leagueName }: { seed: number; leagueName: string }) {
  const key = leagueName.toLocaleLowerCase();
  return (
    <span
      title={`Seed ${seed}, from ${leagueName}`}
      className={clsx(
        'inline-block w-9 rounded px-1 py-0.5 text-center text-xs font-bold tabular-nums',
        isLeagueName(key) ? RANK_COLORS[key] : 'bg-slate-700 text-slate-100',
      )}
    >
      #{seed}
    </span>
  );
}

const PILL_TONE: Record<RoundResult['status'], string> = {
  W: 'bg-emerald-400/90 text-emerald-950',
  L: 'bg-rose-400/90 text-rose-950',
  BYE: 'border border-slate-400 text-slate-300',
  PENDING: 'border border-amber-300 text-amber-200',
};

function describeRound(result: RoundResult): string {
  const round = ROUND_LABEL[result.round];
  if (result.status === 'BYE') return `${round}: bye`;

  const outcome =
    result.status === 'W' ? 'won' : result.status === 'L' ? 'lost' : 'playing';
  const against = result.opponent
    ? ` vs ${result.opponent.name} (#${result.opponent.seed})`
    : ' - opponent to be decided';
  const score =
    result.points !== null && result.opponentPoints !== null
      ? `, ${result.points.toFixed(2)}–${result.opponentPoints.toFixed(2)}`
      : '';
  const note = result.decidedBySeed ? ', tie went to the higher seed' : '';

  return `${round}: ${outcome}${against}${score}${note}`;
}

/**
 * Every Cup as a row of rounds - how far each run went - so a career of
 * brackets reads at a glance.
 */
function BracketRuns({ runs }: { runs: CupRun[] }) {
  return (
    <ProfileSection title='Bracket Runs'>
      <ul className='m-0 list-none space-y-2 p-0'>
        {runs.map(run => (
          <RunRow key={run.year} run={run} />
        ))}
      </ul>
      <RunLegend />
    </ProfileSection>
  );
}

function RunRow({ run }: { run: CupRun }) {
  const byRound = new Map(run.rounds.map(result => [result.round, result]));
  const exit = run.rounds.find(result => result.status === 'L');

  return (
    <li className='flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md bg-slate-900/50 px-3 py-2'>
      <div className='flex items-center gap-2'>
        <span className='w-10 text-sm font-medium tabular-nums text-slate-300'>
          {run.year}
        </span>
        <SeedChip seed={run.seed} leagueName={run.leagueName} />
      </div>

      <ol className='m-0 flex list-none items-center gap-1 p-0'>
        {CUP_ROUNDS.map(round => {
          const result = byRound.get(round);
          return (
            <li key={round}>
              {result ? (
                <span
                  title={describeRound(result)}
                  className={clsx(
                    'flex h-6 w-8 items-center justify-center rounded text-[0.65rem] font-semibold sm:w-10 sm:text-xs',
                    PILL_TONE[result.status],
                  )}
                >
                  {result.status === 'BYE' ? 'Bye' : ROUND_SHORT[round]}
                  <span className='sr-only'>. {describeRound(result)}</span>
                </span>
              ) : (
                <span
                  aria-hidden='true'
                  className='flex h-6 w-8 items-center justify-center text-slate-600 sm:w-10'
                >
                  ·
                </span>
              )}
            </li>
          );
        })}
        {/* The slot is kept either way so every row's finish lines up. */}
        <li className='flex h-6 w-6 items-center justify-center'>
          {run.status === 'champion' && <span title='Cup Champion'>🏆</span>}
        </li>
      </ol>

      <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
        <Finish run={run} />
        {run.eliminatedBy && (
          <span className='text-slate-400'>
            out to <OpponentLink opponent={run.eliminatedBy} />
            {exit && exit.points !== null && exit.opponentPoints !== null && (
              <span className='ml-2 tabular-nums'>
                {exit.points.toFixed(2)} – {exit.opponentPoints.toFixed(2)}
              </span>
            )}
          </span>
        )}
      </div>
    </li>
  );
}

function Finish({ run }: { run: CupRun }) {
  return (
    <span
      className={clsx(
        'font-medium',
        run.status === 'champion'
          ? 'text-gold'
          : run.status === 'alive'
          ? 'text-amber-200'
          : 'text-slate-100',
      )}
    >
      {run.finish}
    </span>
  );
}

function RunLegend() {
  const items: [string, string][] = [
    ['Won', PILL_TONE.W],
    ['Lost', PILL_TONE.L],
    ['Bye', PILL_TONE.BYE],
    ['In progress', PILL_TONE.PENDING],
  ];
  return (
    <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400'>
      {items.map(([label, tone]) => (
        <span key={label} className='inline-flex items-center gap-1.5'>
          <span className={clsx('inline-block h-3 w-4 rounded-sm', tone)} />
          {label}
        </span>
      ))}
    </div>
  );
}

/** Seed and seeding points by year, with the byes they earned. */
function SeedingHistory({ runs }: { runs: CupRun[] }) {
  return (
    <ProfileSection title='Seeding'>
      <ProfileTable
        headers={['Year', 'League', 'Seed', 'Seeding Pts', 'Finish', 'Field']}
        numericColumns={[2, 3, 5]}
      >
        {runs.map(run => (
          <tr key={run.year} className='border-b border-slate-700/70'>
            <td className='px-2 py-2'>{run.year}</td>
            <td className='px-2 py-2'>
              <LeagueChip name={run.leagueName} />
            </td>
            <td className='px-2 py-2 text-right font-medium tabular-nums'>
              {run.rounds[0]?.status === 'BYE' && (
                <span className='mr-2 rounded bg-slate-600/40 px-1.5 py-0.5 text-xs font-normal text-slate-300'>
                  Bye
                </span>
              )}
              #{run.seed}
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {points(run.seedingPoints)}
            </td>
            <td className='px-2 py-2'>
              <Finish run={run} />
            </td>
            <td className='px-2 py-2 text-right tabular-nums text-slate-400'>
              {run.fieldSize}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

const RESULT_TONE: Record<RoundResult['status'], string> = {
  W: 'text-green-400',
  L: 'text-red-400',
  BYE: 'text-slate-400',
  PENDING: 'text-amber-300',
};

function Tag({ tone, children }: { tone: string; children: string }) {
  return (
    <span className={clsx('rounded px-1.5 py-0.5 text-xs', tone)}>
      {children}
    </span>
  );
}

function MatchLog({ games }: { games: MatchLogRow[] }) {
  const years = Array.from(new Set(games.map(game => game.year))).sort(
    (a, b) => b - a,
  );
  const [year, setYear] = useState<number | 'all'>('all');
  const visible = year === 'all' ? games : games.filter(g => g.year === year);

  return (
    <ProfileSection
      title='Match Log'
      action={<YearFilter years={years} value={year} onChange={setYear} />}
    >
      <ProfileTable
        headers={['Year', 'Round', 'Opponent', 'Score', 'Margin', 'Result']}
        numericColumns={[3, 4]}
      >
        {visible.map(game => {
          const margin =
            game.points !== null && game.opponentPoints !== null
              ? game.points - game.opponentPoints
              : null;
          return (
            <tr
              key={`${game.year}-${game.round}`}
              className='border-b border-slate-700/70'
            >
              <td className='px-2 py-2'>{game.year}</td>
              <td className='whitespace-nowrap px-2 py-2'>
                {ROUND_LABEL[game.round]}
                {game.weeks > 1 && game.status !== 'BYE' && (
                  <span className='ml-1.5 text-xs text-slate-500'>
                    {game.weeks} wks
                  </span>
                )}
              </td>
              <td className='px-2 py-2'>
                {game.status === 'BYE' ? (
                  <span className='text-slate-400'>Bye</span>
                ) : game.opponent ? (
                  <OpponentLink opponent={game.opponent} />
                ) : (
                  <span className='text-slate-400'>To be decided</span>
                )}
              </td>
              <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
                {game.status === 'BYE'
                  ? '—'
                  : `${points(game.points)} – ${points(game.opponentPoints)}`}
              </td>
              <td
                className={clsx(
                  'px-2 py-2 text-right tabular-nums',
                  margin === null
                    ? 'text-slate-500'
                    : margin > 0
                    ? 'text-emerald-300'
                    : margin < 0
                    ? 'text-rose-300'
                    : 'text-slate-300',
                )}
              >
                {margin === null || game.status === 'BYE'
                  ? '—'
                  : signed(margin, 2)}
              </td>
              <td className='whitespace-nowrap px-2 py-2'>
                <span
                  className={clsx('mr-2 font-bold', RESULT_TONE[game.status])}
                >
                  {game.status === 'PENDING' ? 'Live' : game.status}
                </span>
                {game.upset && game.status === 'W' && (
                  <Tag tone='bg-emerald-400/15 text-emerald-300'>
                    Beat higher seed
                  </Tag>
                )}
                {game.upset && game.status === 'L' && (
                  <Tag tone='bg-rose-400/15 text-rose-300'>
                    Lost to lower seed
                  </Tag>
                )}
                {game.decidedBySeed && (
                  <Tag tone='bg-slate-600/40 text-slate-300'>
                    Tie, higher seed
                  </Tag>
                )}
              </td>
            </tr>
          );
        })}
      </ProfileTable>
    </ProfileSection>
  );
}
