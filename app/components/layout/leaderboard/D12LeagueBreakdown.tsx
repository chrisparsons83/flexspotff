type Props = {
  byLeague: { leagueId: string; leagueName: string; points: number }[];
};

/** A manager's points split across the D12 leagues they play in. */
export default function D12LeagueBreakdown({ byLeague }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>League</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        {byLeague
          .slice()
          .sort((a, b) => b.points - a.points)
          .map(league => (
            <tr key={league.leagueId}>
              <td>{league.leagueName}</td>
              <td>{league.points.toFixed(2)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
