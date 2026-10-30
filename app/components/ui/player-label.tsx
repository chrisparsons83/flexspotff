/**
 * A player's name, with their position and NFL team after it in small print,
 * spaced apart rather than split by a dot.
 */
export function PlayerLabel({
  player,
}: {
  player: { name: string; position: string | null; nflTeam: string | null };
}) {
  return (
    <>
      {player.name}
      {(player.position || player.nflTeam) && (
        <span className='ml-2 inline-flex gap-1.5 text-sm text-muted-foreground'>
          {player.position && <span>{player.position}</span>}
          {player.nflTeam && <span>{player.nflTeam}</span>}
        </span>
      )}
    </>
  );
}
