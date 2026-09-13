import LeaderboardTable from './LeaderboardTable';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

const entries = [
  {
    id: 'a',
    rank: 1,
    name: 'greg_irl',
    badgeClassName: 'bg-dragon text-gray-900',
    values: ['156.62'],
    details: <div>dragon starters</div>,
  },
  { id: 'b', rank: 2, name: 'selyk', values: ['139.72'] },
];

describe('LeaderboardTable', () => {
  it('renders a row per entry with its rank and values', () => {
    render(
      <LeaderboardTable entries={entries} valueHeadings={['Points For']} />,
    );

    const first = screen.getByText('greg_irl').closest('tr')!;
    expect(within(first).getByText('1')).toBeInTheDocument();
    expect(within(first).getByText('156.62')).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'Points For' }),
    ).toBeInTheDocument();
  });

  // The chevron used to be a click handler on a bare SVG, so the detail rows
  // could not be opened from the keyboard at all.
  it('exposes the expand control as a button and toggles details with it', async () => {
    const user = userEvent.setup();
    render(
      <LeaderboardTable entries={entries} valueHeadings={['Points For']} />,
    );

    expect(screen.queryByText('dragon starters')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Show Details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(screen.getByText('dragon starters')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide Details' }),
    ).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Hide Details' }));
    expect(screen.queryByText('dragon starters')).not.toBeInTheDocument();
  });

  it('offers no expand control for an entry with no details', () => {
    render(
      <LeaderboardTable entries={entries} valueHeadings={['Points For']} />,
    );

    // Only the first entry has details.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('shows the empty message rather than an empty table', () => {
    render(
      <LeaderboardTable
        entries={[]}
        valueHeadings={['Points For']}
        emptyMessage='No scores recorded yet for week 1.'
      />,
    );

    expect(
      screen.getByText('No scores recorded yet for week 1.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
