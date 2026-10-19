import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import StarterGrid from '~/components/layout/leaderboard/StarterGrid';
import GoBox from '~/components/ui/GoBox';
import MemberName from '~/components/ui/MemberName';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible';
import { EmptyState } from '~/components/ui/empty-state';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
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
                <Collapsible>
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
                  <CollapsibleTrigger className='w-full border-t border-border px-5 py-2 text-left text-sm font-semibold text-muted-foreground hover:text-foreground'>
                    Starters
                  </CollapsibleTrigger>
                  <CollapsibleContent className='grid gap-6 px-5 pb-5'>
                    {sides.map(side => (
                      <div key={side.id}>
                        <h3 className='mb-2 font-semibold'>
                          {side.team.user?.discordName ?? 'Unclaimed team'}
                        </h3>
                        <StarterGrid
                          starters={side.starters}
                          startingPlayers={side.startingPlayers}
                          startingPlayerPoints={side.startingPlayerPoints}
                        />
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
