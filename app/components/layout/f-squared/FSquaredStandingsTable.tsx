import FSquaredStandingsRow from '~/components/layout/f-squared/FSquaredStandingsRow';
import type { currentResultsBase } from '~/models/fsquared.server';

type Props = {
  results: currentResultsBase[];
};

export default function FSquaredStandingsTable({ results }: Props) {
  return (
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        {results.map((result, index) => (
          <FSquaredStandingsRow
            rank={index + 1}
            result={result}
            key={result.id}
          />
        ))}
      </tbody>
    </table>
  );
}
