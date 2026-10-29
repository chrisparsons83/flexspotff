import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import MemberName from '~/components/ui/MemberName';
import { ProfileLink } from '~/components/ui/profile-link';
import { Section } from '~/components/ui/section';
import { ordinal } from '~/libs/guillotine/display';
import { bracketIsSet, requireLeague } from '~/libs/leagues/page.server';
import { getPlayoffGamesByLeague } from '~/models/playoffgame.server';
import { cn } from '~/utils';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Playoffs' };

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const league = await requireLeague({ params, request });
  if (!(await bracketIsSet(league))) {
    throw new Response('No playoffs yet', { status: 404 });
  }
  const games = await getPlayoffGamesByLeague(league.id);
  return typedjson({ games });
};

type Game = Awaited<ReturnType<typeof getPlayoffGamesByLeague>>[number];

/** What a game decides: the title, the sacko, a place, or a round. */
const gameLabel = (game: Game) => {
  if (game.placement === null) return null;
  if (game.bracket === 'LOSERS') {
    return game.placement === 1 ? 'Sacko final' : null;
  }
  return game.placement === 1
    ? 'Final'
    : `${ordinal(game.placement)} place game`;
};

const BRACKETS = [
  { key: 'WINNERS', title: 'Winners Bracket' },
  { key: 'LOSERS', title: 'Sacko Bracket' },
] as const;

export default function LeaguePlayoffs() {
  const { games } = useTypedLoaderData<typeof loader>();

  return (
    <>
      {BRACKETS.map(bracket => {
        const inBracket = games.filter(game => game.bracket === bracket.key);
        if (inBracket.length === 0) return null;
        const rounds = [...new Set(inBracket.map(game => game.round))].sort(
          (a, b) => a - b,
        );
        return (
          <Section key={bracket.key} title={bracket.title}>
            <div className='grid gap-8 md:grid-flow-col md:auto-cols-fr'>
              {rounds.map(round => (
                <section key={round}>
                  <h3 className='mb-3 font-bold'>Round {round}</h3>
                  <ul className='grid gap-3'>
                    {inBracket
                      .filter(game => game.round === round)
                      .map(game => (
                        <li key={game.id} className='bg-card'>
                          {gameLabel(game) && (
                            <p className='px-4 pt-2 text-sm text-muted-foreground'>
                              {gameLabel(game)}
                            </p>
                          )}
                          {[game.topTeam, game.bottomTeam].map((team, i) => (
                            <div
                              key={team?.id ?? i}
                              className={cn(
                                'px-4 py-2',
                                game.winningTeamId &&
                                  (team?.id === game.winningTeamId
                                    ? 'font-bold'
                                    : 'text-muted-foreground'),
                              )}
                            >
                              {team?.user ? (
                                <ProfileLink userId={team.user.id}>
                                  <MemberName user={team.user} />
                                </ProfileLink>
                              ) : (
                                'To be decided'
                              )}
                            </div>
                          ))}
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );
}
