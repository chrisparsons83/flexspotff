import MemberName from '~/components/ui/MemberName';
import { FILLS, leagueFill } from '~/components/ui/fills';
import type { CupBracketData } from '~/libs/cup/bracket.server';
import { cn } from '~/utils';
import { roundNameMapping } from '~/utils/constants';

type Bracket = NonNullable<CupBracketData>;
type CupGame = Bracket['cupGames'][number];
type Side = CupGame['topTeam'];

/**
 * The cup, a column per round. Each game is two lines: seed in the team's
 * league colour, manager, and score for the round. The winner is bold and
 * the loser drops back.
 */
export default function CupBracket({ cupGames, scoreArray }: Bracket) {
  return (
    <div className='grid gap-10 lg:grid-flow-col lg:auto-cols-fr lg:gap-2'>
      {roundNameMapping.map(round => {
        const games = cupGames.filter(game => game.round === round.key);
        const score = (side: Side) =>
          scoreArray.find(
            entry =>
              entry.teamId === side?.teamId && entry.mapping === round.key,
          )?.pointsScored;

        return (
          <section key={round.key} className='flex flex-col'>
            <h3 className='mb-3 font-bold lg:text-center'>{round.label}</h3>
            <ul className='grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-col lg:justify-around lg:gap-1'>
              {games.map(game => (
                <li key={game.id} className='bg-card text-sm'>
                  <SideRow
                    side={game.topTeam}
                    score={score(game.topTeam)}
                    won={game.winningTeamId === game.topTeamId}
                    lost={game.losingTeamId === game.topTeamId}
                  />
                  <SideRow
                    side={game.bottomTeam}
                    score={score(game.bottomTeam)}
                    won={game.winningTeamId === game.bottomTeamId}
                    lost={game.losingTeamId === game.bottomTeamId}
                    bye={game.containsBye}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SideRow({
  side,
  score,
  won,
  lost,
  bye = false,
}: {
  side: Side;
  score: number | undefined;
  won: boolean;
  lost: boolean;
  bye?: boolean;
}) {
  const fill = side ? leagueFill(side.team.league.name) : null;
  return (
    <div
      className={cn(
        'grid min-h-8 grid-cols-[1.5rem_1fr_auto] items-center gap-2 px-1 py-0.5',
        won && 'font-bold',
        lost && 'text-muted-foreground',
      )}
    >
      {side?.seed ? (
        <span
          className={cn(
            'flex size-6 items-center justify-center border text-sm font-bold tabular-nums',
            fill ? FILLS[fill] : 'border-border',
          )}
        >
          {side.seed}
        </span>
      ) : (
        <span />
      )}
      <span className='truncate'>
        {bye ? 'Bye' : side?.team.user && <MemberName user={side.team.user} />}
      </span>
      <span className='tabular-nums'>{score ? score.toFixed(2) : ''}</span>
    </div>
  );
}
