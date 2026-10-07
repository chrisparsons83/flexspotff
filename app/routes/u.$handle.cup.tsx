import type { LoaderFunctionArgs } from '@remix-run/node';
import { useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import { InfoText } from '~/components/layout/profile/InfoTip';
import LeagueChip from '~/components/layout/profile/LeagueChip';
import ProfileLink from '~/components/layout/profile/ProfileLink';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable, {
  MobileCard,
  MobileCards,
} from '~/components/layout/profile/ProfileTable';
import SplitBar from '~/components/layout/profile/SplitBar';
import Tag from '~/components/layout/profile/Tag';
import Truncate from '~/components/layout/profile/Truncate';
import WinLoss from '~/components/layout/profile/WinLoss';
import YearFilter from '~/components/layout/profile/YearFilter';
import { plural, pts, signed } from '~/components/layout/profile/format';
import { TEXT } from '~/components/layout/profile/tones';
import { requireProfileMember } from '~/models/profile/access.server';
import type { CupSeeding } from '~/models/profile/cup.server';
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
  const userId = await requireProfileMember(request, params.handle);

  return typedjson({ profile: await getCupProfile(userId) });
};

export default function MemberCup() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    // A first Cup still in its seeding weeks has nothing else to show yet.
    return profile.seeding ? (
      <SeedingHistory runs={[]} seeding={profile.seeding} />
    ) : (
      <ContestEmptyState
        contest='the Cup'
        memberName={summary.user.discordName}
      />
    );
  }

  return (
    <div className='space-y-8'>
      <Career career={profile.career} />
      <SeedingHistory runs={profile.runs} seeding={profile.seeding} />
      <BracketRuns runs={profile.runs} />
      <MatchLog games={profile.matchLog} />
    </div>
  );
}

function OpponentLink({ opponent }: { opponent: CupOpponent }) {
  return (
    <>
      <Truncate title={opponent.name}>
        {opponent.userId ? (
          <ProfileLink userId={opponent.userId} tab='cup'>
            {opponent.name}
          </ProfileLink>
        ) : (
          opponent.name
        )}
      </Truncate>{' '}
      <span className='text-slate-400'>(#{opponent.seed})</span>
    </>
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
            tone={career.titles > 0 ? TEXT.champion : undefined}
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
                ? 'bg-gold'
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

/**
 * A pill names its round, so how it went is in its look alone - and that has
 * to survive red-green colour blindness. A win is bright and solid, a loss
 * dark with a dashed edge, a bye an empty outline and a game still being
 * played a dotted one.
 */
const PILL_TONE: Record<RoundResult['status'], string> = {
  W: 'bg-emerald-300 text-emerald-950',
  L: 'border border-dashed border-rose-400 bg-rose-950 text-rose-200',
  BYE: 'border border-slate-400 text-slate-300',
  PENDING: 'border border-dotted border-amber-300 text-amber-200',
};

const RUN_KEY: [string, string][] = [
  ['Won', PILL_TONE.W],
  ['Lost', PILL_TONE.L],
  ['Bye', PILL_TONE.BYE],
  ['In progress', PILL_TONE.PENDING],
];

function describeRound(result: RoundResult): string {
  const round = ROUND_LABEL[result.round];
  if (result.status === 'BYE') return `${round}: bye`;

  const outcome =
    result.status === 'W' ? 'won' : result.status === 'L' ? 'lost' : 'playing';
  const against = result.opponent
    ? ` vs ${result.opponent.name} (#${result.opponent.seed})`
    : ', opponent to be decided';
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
    <ProfileSection
      title='Bracket Runs'
      info={
        <span className='flex flex-col items-start gap-1.5'>
          {RUN_KEY.map(([label, tone]) => (
            <span key={label} className='inline-flex items-center gap-1.5'>
              <span className={clsx('inline-block h-3 w-4 rounded-sm', tone)} />
              {label}
            </span>
          ))}
        </span>
      }
    >
      <ul className='m-0 list-none space-y-2 p-0'>
        {runs.map(run => (
          <RunRow key={run.year} run={run} />
        ))}
      </ul>
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

      {/* Its own line on a phone, where squeezing it beside the rounds
          left a column a word wide. */}
      <div className='flex min-w-0 flex-1 basis-full flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:basis-0'>
        <Finish run={run} />
        {run.eliminatedBy && (
          <span className='text-slate-400'>
            lost to <OpponentLink opponent={run.eliminatedBy} />
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
          ? TEXT.champion
          : run.status === 'alive'
          ? 'text-amber-200'
          : 'text-slate-100',
      )}
    >
      {run.finish}
    </span>
  );
}

/**
 * Seed and seeding points by year, with the byes they earned. This year's
 * seeding goes on top while it is still being played, ranked the way the
 * seeds will be.
 */
function SeedingHistory({
  runs,
  seeding,
}: {
  runs: CupRun[];
  seeding: CupSeeding | null;
}) {
  return (
    <ProfileSection title='By Season'>
      <ProfileTable
        headers={[
          'Year',
          'League',
          'Seed',
          'Seeding Points',
          'Finish',
          'Field',
        ]}
        primaryColumns={[2, 4]}
        numericColumns={[2, 3, 5]}
      >
        {seeding && <SeedingRow seeding={seeding} />}
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
              {pts(run.seedingPoints)}
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

function SeedingRow({ seeding }: { seeding: CupSeeding }) {
  return (
    <tr className='border-b border-slate-700/70'>
      <td className='px-2 py-2'>{seeding.year}</td>
      <td className='px-2 py-2'>
        <LeagueChip name={seeding.leagueName} />
      </td>
      <td className='px-2 py-2 text-right font-medium tabular-nums'>
        <InfoText
          label={`#${seeding.rank}`}
          tip='Where they rank in the seeding so far'
        >
          #{seeding.rank}
        </InfoText>
      </td>
      <td className='px-2 py-2 text-right tabular-nums'>
        {pts(seeding.points)}
      </td>
      <td className='whitespace-nowrap px-2 py-2 font-medium text-amber-200'>
        Seeding, week {seeding.weeksPlayed} of {seeding.seedingWeeks}
      </td>
      <td className='px-2 py-2 text-right tabular-nums text-slate-400'>
        {seeding.fieldSize}
      </td>
    </tr>
  );
}

const RESULT_TONE: Record<RoundResult['status'], string> = {
  W: TEXT.good,
  L: TEXT.bad,
  BYE: 'text-slate-400',
  PENDING: TEXT.live,
};

/** How a Cup game went, and when a tie was settled by seed. */
function MatchResult({ game }: { game: MatchLogRow }) {
  return (
    <>
      <span className={clsx('font-bold', RESULT_TONE[game.status])}>
        {game.status === 'PENDING' ? 'Live' : game.status}
      </span>
      {game.decidedBySeed && <Tag tone='neutral'>Tie, higher seed</Tag>}
    </>
  );
}

function MatchLog({ games }: { games: MatchLogRow[] }) {
  const years = Array.from(new Set(games.map(game => game.year))).sort(
    (a, b) => b - a,
  );
  const [year, setYear] = useState<number | 'all'>(years[0] ?? 'all');
  const visible = year === 'all' ? games : games.filter(g => g.year === year);

  return (
    <ProfileSection
      title='Match Log'
      action={<YearFilter years={years} value={year} onChange={setYear} />}
    >
      <ProfileTable
        headers={['Year', 'Round', 'Opponent', 'Score', 'Margin', 'Result']}
        numericColumns={[3, 4]}
        mobileCards={
          <MobileCards>
            {visible.map(game => (
              <MobileCard
                key={`${game.year}-${game.round}`}
                title={
                  game.status === 'BYE' ? (
                    <span className='text-slate-400'>Bye</span>
                  ) : game.opponent ? (
                    <>
                      vs <OpponentLink opponent={game.opponent} />
                    </>
                  ) : (
                    <span className='text-slate-400'>To be decided</span>
                  )
                }
                subtitle={`${year === 'all' ? `${game.year} ` : ''}${
                  ROUND_LABEL[game.round]
                }${
                  game.weeks > 1 && game.status !== 'BYE'
                    ? `, ${game.weeks} weeks`
                    : ''
                }`}
                value={
                  game.status === 'BYE'
                    ? undefined
                    : `${pts(game.points)} – ${pts(game.opponentPoints)}`
                }
                status={<MatchResult game={game} />}
              />
            ))}
          </MobileCards>
        }
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
                  <span className='ml-1.5 text-xs text-slate-400'>
                    {game.weeks} weeks
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
                  : `${pts(game.points)} – ${pts(game.opponentPoints)}`}
              </td>
              <td
                className={clsx(
                  'px-2 py-2 text-right tabular-nums',
                  margin === null
                    ? 'text-slate-400'
                    : margin > 0
                    ? TEXT.good
                    : margin < 0
                    ? TEXT.bad
                    : 'text-slate-300',
                )}
              >
                {margin === null || game.status === 'BYE'
                  ? '—'
                  : signed(margin, 2)}
              </td>
              <td className='whitespace-nowrap px-2 py-2'>
                <span className='inline-flex items-center gap-2'>
                  <MatchResult game={game} />
                </span>
              </td>
            </tr>
          );
        })}
      </ProfileTable>
    </ProfileSection>
  );
}
