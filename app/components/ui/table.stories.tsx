import { MobileCard, MobileCards, Table, useTableSort } from './table';
import { WinLoss } from './win-loss';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Table> = {
  title: 'Data display/Table',
  component: Table,
};
export default meta;

type Story = StoryObj<typeof Table>;

type Team = {
  name: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
};

const TEAMS: Team[] = [
  {
    name: 'Panda',
    wins: 9,
    losses: 2,
    pointsFor: 1412.6,
    pointsAgainst: 1201.3,
    streak: 'W4',
  },
  {
    name: 'Lucky',
    wins: 8,
    losses: 3,
    pointsFor: 1388.1,
    pointsAgainst: 1250.9,
    streak: 'W1',
  },
  {
    name: 'Gridiron Gus',
    wins: 7,
    losses: 4,
    pointsFor: 1355.4,
    pointsAgainst: 1290.2,
    streak: 'L1',
  },
  {
    name: 'Kat',
    wins: 6,
    losses: 5,
    pointsFor: 1301.8,
    pointsAgainst: 1322.7,
    streak: 'W2',
  },
  {
    name: 'Sam the Man',
    wins: 4,
    losses: 7,
    pointsFor: 1219.0,
    pointsAgainst: 1366.4,
    streak: 'L3',
  },
  {
    name: 'Mahomes Alone',
    wins: 2,
    losses: 9,
    pointsFor: 1140.5,
    pointsAgainst: 1415.0,
    streak: 'L6',
  },
];

const HEADERS = ['Team', 'Record', 'PF', 'PA', 'Streak'];

/**
 * A row as a plain function rather than a component: the table folds rows by
 * finding its `tr` elements, so a row has to reach it as one.
 */
const row = (team: Team, key: string | number = team.name) => (
  <tr key={key}>
    <td className='font-semibold'>{team.name}</td>
    <td className='text-right'>
      <WinLoss wins={team.wins} losses={team.losses} />
    </td>
    <td className='text-right'>{team.pointsFor.toFixed(1)}</td>
    <td className='text-right'>{team.pointsAgainst.toFixed(1)}</td>
    <td className='text-right'>{team.streak}</td>
  </tr>
);

export const Default: Story = {
  render: () => (
    <Table headers={HEADERS} numericColumns={[1, 2, 3, 4]} caption='Standings'>
      {TEAMS.map(team => row(team))}
    </Table>
  ),
};

/** Press a header to sort by it; press it again to turn the order over. */
export const Sortable: Story = {
  render: function Render() {
    const { rows, sort } = useTableSort(
      TEAMS,
      {
        name: team => team.name,
        wins: team => team.wins,
        pointsFor: team => team.pointsFor,
        pointsAgainst: team => team.pointsAgainst,
      },
      { key: 'wins' },
    );
    return (
      <Table
        headers={HEADERS}
        numericColumns={[1, 2, 3, 4]}
        sortKeys={{ 0: 'name', 1: 'wins', 2: 'pointsFor', 3: 'pointsAgainst' }}
        sort={sort}
        caption='Standings'
      >
        {rows.map(team => row(team))}
      </Table>
    );
  },
};

/** The headers stay in view while a long table scrolls past, on desktop. */
export const StickyHeader: Story = {
  name: 'Sticky header',
  render: () => (
    <Table headers={HEADERS} numericColumns={[1, 2, 3, 4]} stickyHeader>
      {[...TEAMS, ...TEAMS, ...TEAMS, ...TEAMS].map((team, i) => row(team, i))}
    </Table>
  ),
};

export const WithTotals: Story = {
  name: 'With a totals row',
  render: () => (
    <Table
      headers={HEADERS}
      numericColumns={[1, 2, 3, 4]}
      footer={
        <tr>
          <td>League</td>
          <td className='text-right'>
            <WinLoss wins={36} losses={30} />
          </td>
          <td className='text-right'>7817.4</td>
          <td className='text-right'>7846.5</td>
          <td />
        </tr>
      }
    >
      {TEAMS.map(team => row(team))}
    </Table>
  ),
};

/**
 * Below desktop width the record stays and the rest fold into each row,
 * opened with its own button. Narrow the window to see it.
 */
export const FoldingOnAPhone: Story = {
  name: 'Folding, on a phone',
  globals: { viewport: { value: 'mobile2' }, theme: 'dark' },
  render: () => (
    <Table headers={HEADERS} numericColumns={[1, 2, 3, 4]} primaryColumns={[1]}>
      {TEAMS.map(team => row(team))}
    </Table>
  ),
};

/** A log that reads better as two short lines on a phone. */
export const CardsOnAPhone: Story = {
  name: 'Cards, on a phone',
  globals: { viewport: { value: 'mobile2' }, theme: 'dark' },
  render: () => (
    <Table
      headers={HEADERS}
      numericColumns={[1, 2, 3, 4]}
      mobileCards={
        <MobileCards>
          {TEAMS.map(team => (
            <MobileCard
              key={team.name}
              title={team.name}
              subtitle={`Streak ${team.streak}`}
              value={<WinLoss wins={team.wins} losses={team.losses} />}
            />
          ))}
        </MobileCards>
      }
    >
      {TEAMS.map(team => row(team))}
    </Table>
  ),
};
