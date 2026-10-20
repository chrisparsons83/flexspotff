import type { LoaderFunctionArgs } from '@remix-run/node';
import { Fragment } from 'react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import GoBox from '~/components/ui/GoBox';
import MemberName from '~/components/ui/MemberName';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { EmptyState } from '~/components/ui/empty-state';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { PositionMark } from '~/components/ui/swatch';
import { requireLeague } from '~/libs/leagues/page.server';
import { pairTeamGames } from '~/models/profile/shared.server';
import {
  getTeamGamesByLeagueAndWeek,
  getTeamGameWeeksByLeague,
} from '~/models/teamgame.server';
import { cn } from '~/utils';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) =>
    params.week ? `Week ${params.week} matchups` : 'Matchups',
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const league = await requireLeague({ params, request });
  const weeks = await getTeamGameWeeksByLeague(league.id);
  const week = params.week ? Number(params.week) : weeks.at(-1);
  if (week === undefined || !weeks.includes(week)) {
    throw new Response('Week not found', { status: 404 });
  }

  const games = await getTeamGamesByLeagueAndWeek(league.id, week);
  // Each game comes back from both sides; keep the side listed first.
  const matchups = pairTeamGames(games).filter(
    (pair, index, all) =>
      all.findIndex(other => other.game.id === pair.opponent.id) > index,
  );

  return typedjson({
    base: `/leagues/${league.year}/${league.name.toLowerCase()}`,
    week,
    weeks,
    matchups: matchups.map(({ game, opponent }) => ({
      id: game.id,
      sides: [game, opponent],
    })),
  });
};

export default function LeagueMatchups() {
  const { base, week, weeks, matchups } = useTypedLoaderData<typeof loader>();

  return (
    <Section
      title={`Week ${week} matchups`}
      action={
        <GoBox
          buttonText='Week'
          options={[...weeks].reverse().map(option => ({
            label: `Week ${option}`,
            url: `${base}/matchups/${option}`,
          }))}
        />
      }
    >
      {matchups.length === 0 ? (
        <EmptyState title={`No matchups in week ${week}`} />
      ) : (
        <ul className='grid gap-6 md:grid-cols-2'>
          {matchups.map(({ id, sides }) => {
            const [a, b] = sides;
            const played = a.pointsScored > 0 || b.pointsScored > 0;
            return (
              <li key={id} className='bg-card'>
                <Dialog>
                  {sides.map(side => {
                    const other = side === a ? b : a;
                    const won =
                      played && side.pointsScored > other.pointsScored;
                    const lost =
                      played && side.pointsScored < other.pointsScored;
                    return (
                      <div
                        key={side.id}
                        className={cn(
                          'flex items-center justify-between gap-4 px-5 py-3',
                          won && 'font-bold',
                          lost && 'text-muted-foreground',
                        )}
                      >
                        <span className='truncate'>
                          {side.team.user ? (
                            <ProfileLink userId={side.team.user.id}>
                              <MemberName user={side.team.user} />
                            </ProfileLink>
                          ) : (
                            'Unclaimed team'
                          )}
                        </span>
                        <span className='text-lg tabular-nums'>
                          {side.pointsScored.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                  <DialogTrigger className='flex w-full items-center justify-between border-t border-border px-5 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors duration-fast hover:text-foreground'>
                    Starters
                  </DialogTrigger>
                  <MatchupStarters week={week} sides={sides} />
                </Dialog>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

type Side = ReturnType<
  typeof useTypedLoaderData<typeof loader>
>['matchups'][number]['sides'][number];

const sideName = (side: Side) =>
  side.team.user?.discordName ?? 'Unclaimed team';

/** A side's starters in slot order, with their points. */
const lineup = (side: Side) =>
  side.starters.map((starterId, index) => {
    const player = side.startingPlayers.find(
      starter => starter.sleeperId === starterId,
    );
    return {
      key: `${starterId}-${index}`,
      position: player?.position ?? null,
      name: player?.fullName || 'Empty',
      points: side.startingPlayerPoints[index] ?? 0,
    };
  });

/**
 * Both lineups facing each other, slot by slot: the first side reads left to
 * right and the second mirrors it, so each row is one slot's head-to-head,
 * with the better score in bold. A phone has no room for two names a row,
 * so there the lineups stack.
 */
function MatchupStarters({ week, sides }: { week: number; sides: Side[] }) {
  const [a, b] = sides;
  return (
    <DialogContent className='max-w-2xl'>
      <DialogHeader>
        <DialogTitle>
          {sideName(a)} v {sideName(b)}
        </DialogTitle>
        <DialogDescription>Week {week} starters</DialogDescription>
      </DialogHeader>
      {/* Radix mounts this only while the dialog is open. */}
      <Lineups a={a} b={b} />
    </DialogContent>
  );
}

function Lineups({ a, b }: { a: Side; b: Side }) {
  const left = lineup(a);
  const right = lineup(b);
  const rows = Math.max(left.length, right.length);
  const cell = 'py-1.5';
  const points = (mine?: number, theirs?: number) =>
    cn(
      cell,
      'tabular-nums',
      mine !== undefined && theirs !== undefined && mine > theirs
        ? 'font-bold'
        : 'text-muted-foreground',
    );

  return (
    <>
      <div className='hidden grid-cols-[auto_minmax(0,1fr)_auto_auto_minmax(0,1fr)_auto] items-baseline gap-x-3 sm:grid'>
        <span className='col-span-3 border-r border-border pb-2 pr-3 text-right text-lg font-bold tabular-nums'>
          {a.pointsScored.toFixed(2)}
        </span>
        <span className='col-span-3 pb-2 text-lg font-bold tabular-nums'>
          {b.pointsScored.toFixed(2)}
        </span>
        {Array.from({ length: rows }, (_, index) => {
          const home = left[index];
          const away = right[index];
          return (
            <Fragment key={home?.key ?? away?.key ?? index}>
              <PositionMark
                position={home?.position ?? null}
                className={cell}
              />
              <span className={cn(cell, 'truncate')}>{home?.name}</span>
              <span
                className={cn(
                  points(home?.points, away?.points),
                  'border-r border-border pr-3 text-right',
                )}
              >
                {home?.points.toFixed(2)}
              </span>
              <span className={points(away?.points, home?.points)}>
                {away?.points.toFixed(2)}
              </span>
              <span className={cn(cell, 'truncate text-right')}>
                {away?.name}
              </span>
              <PositionMark
                position={away?.position ?? null}
                className={cell}
              />
            </Fragment>
          );
        })}
      </div>

      <div className='grid gap-6 sm:hidden'>
        {[
          { side: a, starters: left },
          { side: b, starters: right },
        ].map(({ side, starters }) => (
          <section key={side.id}>
            <h3 className='mb-2 flex justify-between gap-4 font-bold'>
              <span className='truncate'>{sideName(side)}</span>
              <span className='tabular-nums'>
                {side.pointsScored.toFixed(2)}
              </span>
            </h3>
            <ul className='grid gap-1'>
              {starters.map(starter => (
                <li key={starter.key} className='flex items-baseline gap-2'>
                  <PositionMark position={starter.position} />
                  <span className='min-w-0 flex-1 truncate'>
                    {starter.name}
                  </span>
                  <span className='text-sm tabular-nums text-muted-foreground'>
                    {starter.points.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
