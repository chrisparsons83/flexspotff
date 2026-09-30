import type { LoaderFunctionArgs } from '@remix-run/node';
import { Link, useOutletContext } from '@remix-run/react';
import clsx from 'clsx';
import { Fragment, useState } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import CareerCard, { MiniStat } from '~/components/layout/profile/CareerCard';
import ContestEmptyState from '~/components/layout/profile/ContestEmptyState';
import LeagueChip from '~/components/layout/profile/LeagueChip';
import ProfileLink from '~/components/layout/profile/ProfileLink';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import ProfileTable from '~/components/layout/profile/ProfileTable';
import RangeBar from '~/components/layout/profile/RangeBar';
import YearFilter from '~/components/layout/profile/YearFilter';
import MemberName from '~/components/ui/MemberName';
import { requireProfileAccess } from '~/models/profile/access.server';
import { getFSquaredProfile } from '~/models/profile/fSquared.server';
import type {
  FSquaredCareer,
  FSquaredFan,
  FSquaredFavoriteManager,
  FSquaredMember,
  FSquaredPick,
  FSquaredPickedBy,
  FSquaredPickedBySeason,
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

  const { seasons, career, favoriteManagers, pickedBy } = profile;

  return (
    <div className='space-y-8'>
      <Career career={career} pickedBy={pickedBy} />
      {seasons.length > 0 && <BySeason seasons={seasons} />}
      {seasons.length > 0 && <PickBoard seasons={seasons} />}
      {favoriteManagers.length > 0 && (
        <FavoriteManagers managers={favoriteManagers} />
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

/**
 * Totals are measured against the field rather than shown raw: a season's
 * points depend on how the leagues scored that year, which no pick controls.
 */
function PointsCard({ career }: { career: FSquaredCareer }) {
  const { bestSeason, worstSeason, averageVsField } = career;

  // Only a running season so far: nothing settled to measure yet.
  if (averageVsField === null) {
    return (
      <CareerCard title='Points' lead='—' leadNote='No finished seasons yet'>
        <MiniStat label='Seasons' value={career.seasons} />
      </CareerCard>
    );
  }

  return (
    <CareerCard
      title='Points vs Field'
      lead={
        <span className={signedTone(averageVsField)}>
          {signed(averageVsField, 1)}
        </span>
      }
      leadNote={`a season over the average entry · avg ${pts(
        career.averageTotal,
        0,
      )}`}
      meter={
        bestSeason &&
        worstSeason && (
          <>
            <RangeBar
              low={worstSeason.vsField}
              high={bestSeason.vsField}
              mark={averageVsField}
            />
            <div className='mt-1.5 flex justify-between text-xs text-slate-500'>
              <span>{worstSeason.year}</span>
              <span>{bestSeason.year}</span>
            </div>
          </>
        )
      }
    >
      <MiniStat
        label='Best'
        value={bestSeason ? signed(bestSeason.vsField, 0) : '—'}
        tone={signedTone(bestSeason?.vsField ?? null)}
      />
      <MiniStat
        label='Worst'
        value={worstSeason ? signed(worstSeason.vsField, 0) : '—'}
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
        lead={ordinal(current.rank)}
        leadNote={`of ${current.fieldSize} so far in ${current.year}`}
      >
        <MiniStat label='Seasons' value={career.seasons} />
      </CareerCard>
    ) : null;
  }

  return (
    <CareerCard
      title='Finishes'
      lead={
        career.titles > 0 ? (
          <span className='text-gold'>
            🏆{career.titles > 1 && ` × ${career.titles}`}
          </span>
        ) : (
          ordinal(bestFinish.rank)
        )
      }
      leadNote={[
        career.titles > 0
          ? plural(career.titles, 'title')
          : `best finish, ${bestFinish.year}`,
        current && `${ordinal(current.rank)} in ${current.year}`,
      ]
        .filter(Boolean)
        .join(' · ')}
    >
      <MiniStat
        label='Wins'
        value={career.titles}
        tone={career.titles > 0 ? 'text-gold' : undefined}
      />
      <MiniStat label='Top 3' value={career.podiums} />
      <MiniStat
        label='Percentile'
        value={pct(career.averagePercentile)}
        hint='Average share of the field finished behind them. 100% is first every season.'
      />
    </CareerCard>
  );
}

function PickQualityCard({ career }: { career: FSquaredCareer }) {
  const best = career.bestPickEver;

  return (
    <CareerCard
      title='Pick Quality'
      lead={career.averagePickRank?.toFixed(1) ?? '—'}
      leadNote={`average league finish of ${plural(career.picks, 'pick')}`}
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
      <MiniStat
        label='Best Pick'
        value={best ? signed(best.vsLeague, 0) : '—'}
        detail={
          best ? `${best.manager?.discordName ?? '?'} ${best.year}` : null
        }
        hint='Most points over their league average of any pick'
        tone={signedTone(best?.vsLeague ?? null)}
      />
    </CareerCard>
  );
}

function PickedByCard({ pickedBy }: { pickedBy: FSquaredPickedBy }) {
  const { mostPicked } = pickedBy;

  return (
    <CareerCard
      title='Picked By Others'
      lead={pct(pickedBy.averageShare)}
      leadNote='of entries picked their team, on average'
    >
      <MiniStat
        label='Times Picked'
        value={pickedBy.timesPicked}
        hint='Entries that picked a team they managed, over every season'
      />
      <MiniStat
        label='Most Picked'
        value={mostPicked ? pct(mostPicked.share) : '—'}
        detail={mostPicked ? String(mostPicked.year) : null}
      />
      <MiniStat
        label='Top Fan'
        value={pickedBy.topFans[0]?.picks ?? 0}
        detail={pickedBy.topFans[0]?.member.discordName ?? null}
        hint='The member whose entries picked them most often'
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
        {season.inProgress && ' so far'}
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
      <span className='ml-1.5 text-xs text-slate-500'>
        {ordinal(pick.leagueRank)} {pick.leagueName}
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
          'Points',
          'vs Field',
          'Avg Pick',
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
              title='Average league finish of their picks, on points'
            >
              {season.averagePickRank?.toFixed(1) ?? '—'}
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
 * Where a team finished in its league, top to bottom as bright green to dark
 * red. Lightness climbs with the rank as well as hue, so the scale still reads
 * for red-green colour blindness: bright is good, dark is bad.
 */
const RANK_SCALE = [
  { tone: 'bg-emerald-300 text-emerald-950', label: 'Top 20%' },
  { tone: 'bg-emerald-500 text-emerald-950', label: '60-80%' },
  { tone: 'bg-slate-600 text-slate-100', label: '40-60%' },
  { tone: 'bg-rose-800 text-rose-50', label: '20-40%' },
  { tone: 'bg-rose-950 text-rose-200', label: 'Bottom 20%' },
];

function rankTone(rank: number, size: number): string {
  const percentile = size > 1 ? (size - rank) / (size - 1) : 1;
  const band = Math.min(
    RANK_SCALE.length - 1,
    Math.floor((1 - percentile) * RANK_SCALE.length),
  );
  return RANK_SCALE[band].tone;
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
      footnote={
        <span className='inline-flex flex-wrap items-center gap-x-4 gap-y-1'>
          {RANK_SCALE.map(band => (
            <span key={band.label} className='inline-flex items-center gap-1.5'>
              <span
                aria-hidden='true'
                className={clsx('inline-block h-2.5 w-4 rounded-sm', band.tone)}
              />
              {band.label}
            </span>
          ))}
          <span>★ their own team</span>
        </span>
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
                      <span
                        className={clsx('ml-1.5', signedTone(pick.vsLeague))}
                      >
                        {signed(pick.vsLeague, 0)}
                      </span>
                      <span
                        className='ml-1.5 text-slate-500'
                        title='Other entries that made the same pick'
                      >
                        · {pick.sharedBy === 0 ? 'unique' : `+${pick.sharedBy}`}
                      </span>
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

const FAVORITES_SHOWN = 10;

function FavoriteManagers({
  managers,
}: {
  managers: FSquaredFavoriteManager[];
}) {
  return (
    <ProfileSection
      title='Favorite Managers'
      description='The managers they picked most often'
    >
      <ProfileTable
        headers={['Manager', 'Picks', 'Years', 'Avg Finish', 'vs League']}
        numericColumns={[1, 3, 4]}
      >
        {managers.slice(0, FAVORITES_SHOWN).map(row => (
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
 * The other side of the game: the teams they managed, and who bet on them.
 * Popularity sits beside the team's actual finish, so a crowd favourite that
 * flopped - or a team everyone passed on that won the league - stands out.
 */
function WhoPickedThem({
  pickedBy,
  memberName,
}: {
  pickedBy: FSquaredPickedBy;
  memberName: string;
}) {
  return (
    <ProfileSection
      title={`Who Picked ${memberName}`}
      description='Entries that picked a team they managed'
    >
      <div className='grid gap-6 lg:grid-cols-3'>
        <div className='lg:col-span-2'>
          <ProfileTable
            headers={['Year', 'League', 'Picked By', 'Popularity', 'Finish']}
            numericColumns={[2, 3, 4]}
          >
            {pickedBy.seasons.map(season => (
              <PickedByRow key={season.teamId} season={season} />
            ))}
          </ProfileTable>
        </div>
        <TopFans fans={pickedBy.topFans} />
      </div>
    </ProfileSection>
  );
}

function PickedByRow({ season }: { season: FSquaredPickedBySeason }) {
  const [open, setOpen] = useState(false);
  const count = season.pickers.length;

  return (
    <Fragment>
      <tr className='border-b border-slate-700/70'>
        <td className='whitespace-nowrap px-2 py-2'>
          {season.year}
          {season.inProgress && <CurrentTag />}
        </td>
        <td className='px-2 py-2'>
          <LeagueChip name={season.leagueName} />
        </td>
        <td className='whitespace-nowrap px-2 py-2 text-right tabular-nums'>
          {count > 0 ? (
            <button
              type='button'
              onClick={() => setOpen(value => !value)}
              aria-expanded={open}
              className='font-medium text-slate-100 underline decoration-slate-500 decoration-dotted underline-offset-2 hover:decoration-slate-200'
            >
              {count}
            </button>
          ) : (
            <span className='text-slate-500'>0</span>
          )}
          <span className='text-slate-400'>
            {' '}
            of {season.fieldSize}
            <span className='ml-1.5 text-xs text-slate-500'>
              {pct(season.share)}
            </span>
          </span>
        </td>
        <td
          className='px-2 py-2 text-right tabular-nums'
          title={`${ordinal(season.popularityRank)} most picked of ${
            season.leagueSize
          } teams`}
        >
          {ordinal(season.popularityRank)}
        </td>
        <td className='px-2 py-2 text-right'>
          <span
            className={clsx(
              'inline-block rounded px-1.5 py-0.5 text-xs font-bold tabular-nums',
              rankTone(season.leagueRank, season.leagueSize),
            )}
            title={`${pts(season.pointsFor)} points`}
          >
            {ordinal(season.leagueRank)}
          </span>
        </td>
      </tr>
      {open && (
        <tr className='border-b border-slate-700/70 bg-slate-900/40'>
          <td colSpan={5} className='px-2 py-2 text-sm'>
            <ul className='m-0 flex flex-wrap gap-x-3 gap-y-1 p-0'>
              {season.pickers.map(picker => (
                <li key={picker.id} className='list-none'>
                  <Member member={picker} />
                  {picker.isSelf && (
                    <span className='ml-1 text-gold' title='Picked themselves'>
                      ★
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

const FANS_SHOWN = 10;

function TopFans({ fans }: { fans: FSquaredFan[] }) {
  return (
    <div className='rounded-md bg-slate-900/50 p-4'>
      <h4 className='m-0 text-sm font-semibold text-slate-300'>Biggest Fans</h4>
      {fans.length === 0 ? (
        <p className='m-0 mt-3 text-sm text-slate-400'>Nobody yet.</p>
      ) : (
        <ol className='m-0 mt-3 space-y-1.5 p-0'>
          {fans.slice(0, FANS_SHOWN).map(fan => (
            <li
              key={fan.member.id}
              className='flex list-none items-baseline justify-between gap-3 text-sm'
            >
              <span className='truncate'>
                <Member member={fan.member} />
              </span>
              <span
                className='shrink-0 tabular-nums text-slate-400'
                title={fan.years.join(', ')}
              >
                <span className='font-medium text-slate-100'>{fan.picks}</span>×
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
