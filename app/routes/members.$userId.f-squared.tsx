import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import LeagueChip from '~/components/layout/profile/LeagueChip';
import ProfileLink from '~/components/layout/profile/ProfileLink';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import YearFilter from '~/components/layout/profile/YearFilter';
import MemberName from '~/components/ui/MemberName';
import { requireProfileAccess } from '~/models/profile/access.server';
import { getFSquaredProfile } from '~/models/profile/fSquared.server';
import type {
  FSquaredCareer,
  FSquaredPickedManager,
  FSquaredMember,
  FSquaredPick,
  FSquaredPickedBy,
  FSquaredSeason,
} from '~/models/profile/fSquaredProfile';
import type { ProfileSummary } from '~/models/profile/summary.server';

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await requireProfileAccess(request);

  const { userId } = params;
  if (!userId) throw new Response('Not Found', { status: 404 });

  return typedjson({ profile: await getFSquaredProfile(userId) });
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

const pct = (value: number | null) =>
  value === null ? '—' : `${Math.round(value * 100)}%`;

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

const ordinal = (rank: number) => {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  return `${rank}${['th', 'st', 'nd', 'rd'][rank % 10] ?? 'th'}`;
};

/** A member's name, linked to their profile for anyone who can open it. */
function Member({ member }: { member: FSquaredMember | null }) {
  if (!member) return <span className='text-slate-500'>Unknown</span>;
  return (
    <ProfileLink userId={member.id}>
      <MemberName user={member} />
    </ProfileLink>
  );
}

export default function MemberFSquared() {
  const { profile } = useTypedLoaderData<typeof loader>();
  const summary = useOutletContext<ProfileSummary>();

  if (!profile.hasPlayed) {
    return (
      <ContestEmptyState contest='F²' memberName={summary.user.discordName} />
    );
  }

  const { seasons, career, mostPickedManagers, pickedBy } = profile;

  return (
    <div className='space-y-8'>
      <Career career={career} pickedBy={pickedBy} />
      {seasons.length > 0 && <BySeason seasons={seasons} />}
      {seasons.length > 0 && <PickBoard seasons={seasons} />}
      {mostPickedManagers.length > 0 && (
        <MostPickedManagers managers={mostPickedManagers} />
      )}
      {pickedBy.seasons.length > 0 && (
        <WhoPickedThem
          pickedBy={pickedBy}
          memberName={summary.user.discordName}
        />
      )}
    </div>
  );
}

/**
 * What they did with their entries, then what everyone else did with them.
 * Someone who never entered gets only the second half.
 */
function Career({
  career,
  pickedBy,
}: {
  career: FSquaredCareer | null;
  pickedBy: FSquaredPickedBy;
}) {
  return (
    <ProfileSection title='Career'>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {career && (
          <>
            <PointsCard career={career} />
            <FinishesCard career={career} />
            <PickQualityCard career={career} />
          </>
        )}
        {pickedBy.seasons.length > 0 && <PickedByCard pickedBy={pickedBy} />}
      </div>
    </ProfileSection>
  );
}

/** Small print beside a headline, saying what the number counts. */
function LeadContext({ children }: { children: string }) {
  return (
    <span className='ml-1.5 text-sm font-normal text-slate-400'>
      {children}
    </span>
  );
}

const whole = (value: number) => Math.round(value).toLocaleString('en-US');

/**
 * Totals are measured against the field rather than shown raw: a season's
 * points depend on how the leagues scored that year, which no pick controls.
 */
function PointsCard({ career }: { career: FSquaredCareer }) {
  const { bestSeason, worstSeason, averageVsField, averageTotal } = career;
  const title = 'Points vs Average Entry';

  // Only a running season so far: nothing settled to measure yet.
  if (averageVsField === null || averageTotal === null) {
    return (
      <CareerCard title={title} lead='—'>
        <MiniStat label='Seasons' value={career.seasons} />
      </CareerCard>
    );
  }

  return (
    <CareerCard
      title={title}
      lead={
        <span className={signedTone(averageVsField)}>
          {signed(averageVsField, 1)}
        </span>
      }
    >
      <MiniStat
        label='Average Score'
        value={whole(averageTotal)}
        hint='Their average season score'
      />
      <MiniStat
        label='Best'
        value={bestSeason ? signed(bestSeason.vsField, 0) : '—'}
        detail={bestSeason ? String(bestSeason.year) : null}
        tone={signedTone(bestSeason?.vsField ?? null)}
      />
      <MiniStat
        label='Worst'
        value={worstSeason ? signed(worstSeason.vsField, 0) : '—'}
        detail={worstSeason ? String(worstSeason.year) : null}
        tone={signedTone(worstSeason?.vsField ?? null)}
      />
    </CareerCard>
  );
}

function FinishesCard({ career }: { career: FSquaredCareer }) {
  const { bestFinish, current } = career;

  // A member still in their first season has no finishes yet; show where
  // they stand instead.
  if (!bestFinish) {
    return current ? (
      <CareerCard
        title='Standing'
        lead={
          <>
            {ordinal(current.rank)}
            <LeadContext>{`of ${current.fieldSize}`}</LeadContext>
          </>
        }
      >
        <MiniStat label='Seasons' value={career.seasons} />
      </CareerCard>
    ) : null;
  }

  return (
    <CareerCard
      title='Best Finish'
      lead={
        career.titles > 0 ? (
          <span className='text-gold'>
            🏆{career.titles > 1 && ` × ${career.titles}`}
          </span>
        ) : (
          <>
            {ordinal(bestFinish.rank)}
            <LeadContext>{String(bestFinish.year)}</LeadContext>
          </>
        )
      }
    >
      <MiniStat
        label='Wins'
        value={career.titles}
        tone={career.titles > 0 ? 'text-gold' : undefined}
      />
      <MiniStat label='Top 3' value={career.podiums} />
      <MiniStat
        label='Top Half'
        value={career.topHalves}
        unit={`/${career.completedSeasons}`}
        hint='Finished seasons in the top half of the field'
      />
    </CareerCard>
  );
}

/**
 * How often a pick came good, rather than by how much - Points vs Average
 * Entry already covers the margin. A pick "beats the average" when its team
 * outscores the average team in its league, so a high-scoring league does not
 * flatter the picks made in it.
 */
function PickQualityCard({ career }: { career: FSquaredCareer }) {
  return (
    <CareerCard
      title='Picks That Beat League Average'
      lead={pct(career.beatAverageShare)}
    >
      <MiniStat
        label='Top 3'
        value={pct(career.topThreeShare)}
        hint='Picks that finished top 3 in their league on points'
        tone='text-emerald-300'
      />
      <MiniStat
        label='Bottom 3'
        value={pct(career.bottomThreeShare)}
        hint='Picks that finished in the bottom 3 of their league on points'
        tone='text-rose-300'
      />
      <MiniStat label='Picks' value={career.picks} />
    </CareerCard>
  );
}

function PickedByCard({ pickedBy }: { pickedBy: FSquaredPickedBy }) {
  const { mostPicked } = pickedBy;

  return (
    <CareerCard title='Picked By Others' lead={pct(pickedBy.averageShare)}>
      <MiniStat
        label='Times Picked'
        value={pickedBy.timesPicked}
        hint='Entries that picked a team they managed, over every season'
      />
      <MiniStat
        label='Unique Pickers'
        value={pickedBy.frequentPickers.length}
        hint='Different members who have picked them'
      />
      <MiniStat
        label='Most Picked'
        value={mostPicked ? pct(mostPicked.share) : '—'}
        detail={mostPicked ? String(mostPicked.year) : null}
      />
    </CareerCard>
  );
}

function CurrentTag() {
  return (
    <span className='ml-2 rounded bg-sky-400/15 px-1.5 py-0.5 text-xs font-medium text-sky-200'>
      Current
    </span>
  );
}

function SeasonFinish({ season }: { season: FSquaredSeason }) {
  return (
    <span
      className={clsx(
        'font-medium',
        season.champion ? 'text-gold' : 'text-slate-100',
      )}
    >
      {season.champion && '🏆 '}
      {ordinal(season.finish.rank)}
      <span className='font-normal text-slate-400'>
        {' '}
        of {season.finish.fieldSize}
      </span>
    </span>
  );
}

function PickCell({ pick }: { pick: FSquaredPick | null }) {
  if (!pick) return <>—</>;
  return (
    <>
      <span className={signedTone(pick.vsLeague)}>
        {pick.manager?.discordName ?? 'Unknown'}
      </span>
      <span className='ml-1.5 text-xs tabular-nums text-slate-500'>
        {pts(pick.pointsFor)}
      </span>
    </>
  );
}

function BySeason({ seasons }: { seasons: FSquaredSeason[] }) {
  return (
    <ProfileSection title='By Season'>
      <ProfileTable
        headers={[
          'Year',
          'Finish',
          'Score',
          'vs Field',
          'Beat Average',
          'Best Pick',
          'Worst Pick',
          'Picked By',
        ]}
        numericColumns={[2, 3, 4, 7]}
      >
        {seasons.map(season => (
          <tr key={season.year} className='border-b border-slate-700/70'>
            <td className='whitespace-nowrap px-2 py-2'>
              <Link to={`/games/f-squared/standings/${season.year}`}>
                {season.year}
              </Link>
              {season.inProgress && <CurrentTag />}
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              <SeasonFinish season={season} />
            </td>
            <td className='px-2 py-2 text-right font-medium tabular-nums'>
              {pts(season.total)}
            </td>
            <td
              className={clsx(
                'px-2 py-2 text-right tabular-nums',
                signedTone(season.vsField),
              )}
            >
              {signed(season.vsField)}
            </td>
            <td
              className='px-2 py-2 text-right tabular-nums'
              title="Picks that outscored their league's average team"
            >
              {season.beatAverage}
              <span className='text-slate-500'>/{season.picks.length}</span>
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              <PickCell pick={season.bestPick} />
            </td>
            <td className='whitespace-nowrap px-2 py-2'>
              <PickCell pick={season.worstPick} />
            </td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {season.timesPicked ?? '—'}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

/**
 * Whether a team finished in the top or bottom half of its league. Two bands
 * rather than a gradient, since the rank is written on the badge anyway.
 *
 * Light green against dark red, so the halves differ in lightness as well as
 * hue and still read apart with red-green colour blindness.
 */
const HALVES = {
  top: { tone: 'bg-emerald-300 text-emerald-950', label: 'Top half' },
  bottom: { tone: 'bg-rose-900 text-rose-50', label: 'Bottom half' },
} as const;

function rankTone(rank: number, size: number): string {
  return rank <= size / 2 ? HALVES.top.tone : HALVES.bottom.tone;
}

/** A season's entry laid out league by league, the way it was picked. */
function PickBoard({ seasons }: { seasons: FSquaredSeason[] }) {
  const years = seasons.map(season => season.year);
  const [year, setYear] = useState<number>(years[0]);
  const season = seasons.find(s => s.year === year) ?? seasons[0];

  const leagues = new Map<string, FSquaredPick[]>();
  for (const pick of season.picks) {
    const list = leagues.get(pick.leagueName);
    if (list) list.push(pick);
    else leagues.set(pick.leagueName, [pick]);
  }

  return (
    <ProfileSection
      title='Picks'
      description='Each pick with where it finished in its league on points'
      action={
        <YearFilter
          years={years}
          value={season.year}
          onChange={value => value !== 'all' && setYear(value)}
          showAll={false}
        />
      }
    >
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-5'>
        {Array.from(leagues.entries()).map(([leagueName, picks]) => (
          <div key={leagueName} className='rounded-md bg-slate-900/50 p-3'>
            <LeagueChip name={leagueName} />
            <ul className='m-0 mt-3 space-y-2 p-0'>
              {picks.map(pick => (
                <li key={pick.teamId} className='flex list-none gap-2'>
                  <span
                    className={clsx(
                      'flex h-8 w-9 shrink-0 items-center justify-center rounded text-xs font-bold tabular-nums',
                      rankTone(pick.leagueRank, pick.leagueSize),
                    )}
                    title={`${ordinal(pick.leagueRank)} of ${
                      pick.leagueSize
                    } in ${leagueName}`}
                  >
                    {ordinal(pick.leagueRank)}
                  </span>
                  <div className='min-w-0 text-sm leading-tight'>
                    <div className='truncate text-slate-100'>
                      <Member member={pick.manager} />
                      {pick.isSelf && (
                        <span className='ml-1 text-gold' title='Their own team'>
                          ★
                        </span>
                      )}
                    </div>
                    <div className='text-xs text-slate-400 tabular-nums'>
                      {pts(pick.pointsFor)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

const MANAGERS_SHOWN = 10;

function MostPickedManagers({
  managers,
}: {
  managers: FSquaredPickedManager[];
}) {
  return (
    <ProfileSection title='Most Picked Managers'>
      <ProfileTable
        headers={['Manager', 'Picks', 'Years', 'Average Finish', 'vs League']}
        numericColumns={[1, 3, 4]}
      >
        {managers.slice(0, MANAGERS_SHOWN).map(row => (
          <tr key={row.manager.id} className='border-b border-slate-700/70'>
            <td className='whitespace-nowrap px-2 py-2'>
              <Member member={row.manager} />
              {row.isSelf && (
                <span className='ml-1 text-gold' title='Themselves'>
                  ★
                </span>
              )}
            </td>
            <td className='px-2 py-2 text-right font-medium tabular-nums'>
              {row.picks}
            </td>
            <td className='px-2 py-2 text-slate-400'>{row.years.join(', ')}</td>
            <td className='px-2 py-2 text-right tabular-nums'>
              {row.averageRank.toFixed(1)}
            </td>
            <td
              className={clsx(
                'px-2 py-2 text-right tabular-nums',
                signedTone(row.averageVsLeague),
              )}
            >
              {signed(row.averageVsLeague, 1)}
            </td>
          </tr>
        ))}
      </ProfileTable>
    </ProfileSection>
  );
}

/**
 * The other side of the game: everyone whose entries picked a team this member
 * managed, most often first, with the years they did it.
 */
function WhoPickedThem({
  pickedBy,
  memberName,
}: {
  pickedBy: FSquaredPickedBy;
  memberName: string;
}) {
  const pickers = pickedBy.frequentPickers;

  return (
    <ProfileSection title={`Who Picked ${memberName}`}>
      {pickers.length === 0 ? (
        <p className='m-0 text-sm text-slate-400'>Nobody yet.</p>
      ) : (
        <ol className='m-0 p-0'>
          {pickers.map(row => (
            <li
              key={row.member.id}
              className='flex list-none items-baseline gap-4 border-b border-slate-700/70 py-2 text-sm last:border-b-0'
            >
              <span
                className='w-6 shrink-0 text-right text-lg font-bold tabular-nums text-white'
                title={`Picked them ${plural(row.picks, 'time')}`}
              >
                {row.picks}
              </span>
              <span className='min-w-0 truncate'>
                <Member member={row.member} />
              </span>
              <span className='ml-auto shrink-0 text-xs tabular-nums text-slate-500'>
                {row.years.join(', ')}
              </span>
            </li>
          ))}
        </ol>
      )}
    </ProfileSection>
  );
}
