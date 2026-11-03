import CupGameDialog from './CupGameDialog';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import { type ReactNode, useState } from 'react';
import MemberName from '~/components/ui/MemberName';
import { CollapsibleTrigger } from '~/components/ui/collapsible';
import { FILLS, leagueFill } from '~/components/ui/fills';
import { ProfileLink } from '~/components/ui/profile-link';
import { FOCUS_RING } from '~/components/ui/styles';
import type { CupBracketData } from '~/libs/cup/bracket.server';
import type { RoundTotal } from '~/libs/cup/lineups';
import { roundTotalKey } from '~/libs/cup/lineups';
import { cn } from '~/utils';
import { roundNameMapping } from '~/utils/constants';

type Bracket = NonNullable<CupBracketData>;
type CupGame = Bracket['cupGames'][number];
type Side = CupGame['topTeam'];

/** The line between rounds, as a border. */
const LINE = 'border-border';

/**
 * The cup, a column per round. Each game is two lines: seed in the team's
 * league colour, manager, and score for the round, with its projection under
 * that where there is one. The winner is bold and the loser drops back. A
 * game's scores open its lineups.
 *
 * On a wide screen lines join each pair of games to the game their winners
 * meet in. That works because games come in bracket order: games 2k and
 * 2k+1 of a round feed game k of the next. Each pair sits in a box as tall
 * as one game's slot in the next round, so its middle lines up with that
 * game. On a phone the rounds stack, and each folds away under its name.
 */
export default function CupBracket({
  cupGames,
  scoreArray,
  weeksByRound,
  roundTotals,
}: Bracket & { roundTotals: Record<string, RoundTotal> }) {
  const [opened, setOpened] = useState<{
    game: CupGame;
    round: string;
    weeks: string | null;
  } | null>(null);
  const rounds = roundNameMapping.map(round => ({
    ...round,
    games: cupGames.filter(game => game.round === round.key),
  }));
  // The round being played: the last one with a team in it.
  const current = rounds
    .map(round => round.games.some(game => game.topTeam || game.bottomTeam))
    .lastIndexOf(true);

  return (
    <div className='grid gap-4 lg:grid-flow-col lg:auto-cols-fr'>
      {opened && <CupGameDialog {...opened} onClose={() => setOpened(null)} />}
      {rounds.map((round, index) => {
        const score = (side: Side) =>
          scoreArray.find(
            entry =>
              entry.teamId === side?.teamId && entry.mapping === round.key,
          )?.pointsScored;
        const projected = (side: Side) =>
          side
            ? roundTotals[roundTotalKey(round.key, side.teamId)]?.projected
            : null;
        const weeks = weeksLabel(weeksByRound[round.key] ?? []);
        const last = index === rounds.length - 1;
        const pairs = last
          ? [round.games]
          : round.games.flatMap((game, i) =>
              i % 2 === 0 ? [round.games.slice(i, i + 2)] : [],
            );

        return (
          <Round
            key={round.key}
            label={round.label}
            weeks={weeks}
            defaultOpen={index === Math.max(current, 0)}
          >
            {pairs.map(pair => (
              <li
                key={pair[0]!.id}
                className='contents lg:relative lg:flex lg:flex-1 lg:flex-col'
              >
                {pair.map(game => (
                  <div
                    key={game.id}
                    className={cn(
                      'lg:flex lg:flex-1 lg:items-center lg:py-0.5',
                      !last && 'lg:pr-2',
                    )}
                  >
                    <div className='relative w-full bg-card text-sm'>
                      {index > 0 && (
                        <span
                          aria-hidden
                          className={cn(
                            'absolute right-full top-1/2 hidden w-2 border-t lg:block',
                            LINE,
                          )}
                        />
                      )}
                      <SideRow
                        side={game.topTeam}
                        score={score(game.topTeam)}
                        projected={projected(game.topTeam)}
                        onOpen={() =>
                          setOpened({ game, round: round.label, weeks })
                        }
                        won={game.winningTeamId === game.topTeamId}
                        lost={game.losingTeamId === game.topTeamId}
                      />
                      <SideRow
                        side={game.bottomTeam}
                        score={score(game.bottomTeam)}
                        projected={projected(game.bottomTeam)}
                        onOpen={() =>
                          setOpened({ game, round: round.label, weeks })
                        }
                        won={game.winningTeamId === game.bottomTeamId}
                        lost={game.losingTeamId === game.bottomTeamId}
                        bye={game.containsBye}
                      />
                    </div>
                  </div>
                ))}
                {!last && (
                  <>
                    {/* Joins the pair's two games, from their middles. */}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute bottom-1/4 right-0 top-1/4 hidden w-2 border-y border-r lg:block',
                        LINE,
                      )}
                    />
                    {/* On to the game the winners meet in. */}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute left-full top-1/2 hidden w-2 border-t lg:block',
                        LINE,
                      )}
                    />
                  </>
                )}
              </li>
            ))}
          </Round>
        );
      })}
    </div>
  );
}

/**
 * One round's column. On a phone its name opens and closes it; on a wide
 * screen every round shows, so the bracket reads across.
 */
function Round({
  label,
  weeks,
  defaultOpen,
  children,
}: {
  label: string;
  /** When it is scored, such as "Weeks 7–8". */
  weeks: string | null;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const list =
    'grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-col lg:gap-0';

  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen} asChild>
      <section className='flex flex-col'>
        <h3 className='font-bold lg:hidden'>
          <CollapsibleTrigger className='py-2'>
            <span>
              {label}
              {weeks && (
                <span className='ml-2 text-sm font-normal text-muted-foreground'>
                  {weeks}
                </span>
              )}
            </span>
          </CollapsibleTrigger>
        </h3>
        <div className='mb-3 hidden text-center lg:block'>
          <h3 className='font-bold'>{label}</h3>
          {weeks && <p className='text-sm text-muted-foreground'>{weeks}</p>}
        </div>
        <CollapsiblePrimitive.Content
          forceMount
          asChild
          className='mt-1 data-[state=closed]:max-lg:hidden'
        >
          <ul className={cn(list, 'lg:mt-0')}>{children}</ul>
        </CollapsiblePrimitive.Content>
      </section>
    </CollapsiblePrimitive.Root>
  );
}

/**
 * A round's NFL weeks, so a two-week round reads as one: "Week 5",
 * "Weeks 7–8".
 */
function weeksLabel(weeks: number[]) {
  if (weeks.length === 0) return null;
  if (weeks.length === 1) return `Week ${weeks[0]}`;
  const consecutive = weeks.every(
    (week, index) => index === 0 || week === weeks[index - 1]! + 1,
  );
  return consecutive
    ? `Weeks ${weeks[0]}–${weeks[weeks.length - 1]}`
    : `Weeks ${weeks.join(', ')}`;
}

function SideRow({
  side,
  score,
  projected,
  onOpen,
  won,
  lost,
  bye = false,
}: {
  side: Side;
  score: number | undefined;
  projected: number | null | undefined;
  onOpen: () => void;
  won: boolean;
  lost: boolean;
  bye?: boolean;
}) {
  const fill = side ? leagueFill(side.team.league.name) : null;
  const hasProjection = typeof projected === 'number';
  return (
    <div
      className={cn(
        'grid min-h-8 grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 px-1 py-0.5',
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
        {bye
          ? 'Bye'
          : side?.team.user && (
              <ProfileLink userId={side.team.user.id}>
                <MemberName user={side.team.user} />
              </ProfileLink>
            )}
      </span>
      {score || hasProjection ? (
        <button
          type='button'
          onClick={onOpen}
          aria-haspopup='dialog'
          className={cn(
            'grid justify-items-end tabular-nums hover:underline',
            FOCUS_RING,
          )}
        >
          {score ? <span className='text-base'>{score.toFixed(2)}</span> : null}
          {hasProjection && (
            <span
              title='Projected'
              className='text-sm font-normal italic text-muted-foreground/90'
            >
              <span className='sr-only'>Projected </span>
              {projected.toFixed(2)}
            </span>
          )}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}
