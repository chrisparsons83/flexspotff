import D12LeagueBreakdown from './D12LeagueBreakdown';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { D12LeagueTotal } from '~/models/d12weekscore.server';
import type { Player } from '~/models/players.server';

const player = (sleeperId: string, fullName: string, position: string) =>
  ({ sleeperId, fullName, position } as Player);

// christhrowrocks' week 1 lineup in The D12 v12, the roster that read 45.30 off
// Sleeper's own `points` field while its UI showed this 115.90.
const V12: D12LeagueTotal = {
  leagueId: 'l12',
  leagueName: 'The D12 v12',
  points: 115.9,
  weekCount: 1,
  starters: ['12545', '4034', '7543', '9486', '2449', '10236', '9484', '13279'],
  startingPlayerPoints: [26.45, 11.3, 11.3, 15.55, 15.25, 19.25, 10.25, 6.55],
};

const players = [
  player('12545', 'Tyler Shough', 'QB'),
  player('4034', 'Christian McCaffrey', 'RB'),
  player('7543', 'Travis Etienne', 'RB'),
  player('9486', 'Dontayvion Wicks', 'WR'),
  player('2449', 'Stefon Diggs', 'WR'),
  player('10236', 'Dalton Kincaid', 'TE'),
  player('9484', 'Tucker Kraft', 'TE'),
  player('13279', 'Carnell Tate', 'WR'),
];

describe('D12LeagueBreakdown', () => {
  it("lists a manager's teams best first", () => {
    render(
      <D12LeagueBreakdown
        byLeague={[
          { ...V12, leagueId: 'l1', leagueName: 'The D12 v1', points: 99.98 },
          V12,
        ]}
      />,
    );

    const leagues = screen
      .getAllByRole('row')
      .slice(1)
      .map(row => within(row).getAllByRole('cell')[0].textContent);
    expect(leagues).toEqual(['The D12 v12', 'The D12 v1']);
  });

  it('shows the best-ball lineup behind the points on the weekly board', () => {
    render(
      <D12LeagueBreakdown byLeague={[V12]} showLineups players={players} />,
    );

    expect(screen.getByText('115.90')).toBeInTheDocument();
    expect(screen.getByText('Tyler Shough')).toBeInTheDocument();
    expect(screen.getByText('26.45 pts')).toBeInTheDocument();
    expect(screen.getByText('Dalton Kincaid')).toBeInTheDocument();
    expect(screen.getByText('6.55 pts')).toBeInTheDocument();
  });

  // Over a season a team's stored starters cover one week of many, so there is no
  // single lineup to show and computeD12Leaderboard hands back none.
  it('shows points alone on the season board', () => {
    render(
      <D12LeagueBreakdown
        byLeague={[
          { ...V12, weekCount: 17, starters: [], startingPlayerPoints: [] },
        ]}
        players={players}
      />,
    );

    expect(screen.getByText('115.90')).toBeInTheDocument();
    expect(screen.queryByText('Tyler Shough')).not.toBeInTheDocument();
  });
});
