/** A player's name, with their position and NFL team in small print. */
export default function PlayerLabel({
  player,
}: {
  player: { name: string; position: string | null; nflTeam: string | null };
}) {
  return (
    <>
      {player.name}
      {(player.position || player.nflTeam) && (
        <span className='ml-1 text-xs text-slate-400'>
          {[player.position, player.nflTeam].filter(Boolean).join(' · ')}
        </span>
      )}
    </>
  );
}
