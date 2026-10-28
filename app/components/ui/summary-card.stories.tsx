import { Link } from './link';
import { SummaryCard } from './summary-card';
import type { Meta, StoryObj } from '@storybook/react-vite';

const member = (id: string, discordName: string) => ({
  id,
  discordName,
  discordUsername: null,
});

const meta: Meta<typeof SummaryCard> = {
  title: 'Data display/SummaryCard',
  component: SummaryCard,
  decorators: [
    Story => (
      <div className='max-w-sm'>
        <Story />
      </div>
    ),
  ],
  parameters: {
    remix: { rootData: { canViewProfiles: true, profileHandles: {} } },
  },
};
export default meta;

type Story = StoryObj<typeof SummaryCard>;

/** A game's leaders on the Games overview. */
export const Leaders: Story = {
  args: {
    title: 'Spread pool',
    to: '/games/spread-pool',
    status: 'Week 8 open for picks',
    rows: [
      { key: 'a', rank: 1, user: member('a', 'Panda'), value: '1240' },
      { key: 'b', rank: 2, user: member('b', 'Snarky'), value: '1185' },
      { key: 'c', rank: 2, user: member('c', 'Allen'), value: '1185' },
      { key: 'd', rank: 4, user: member('d', 'Grant'), value: '1110' },
      { key: 'e', rank: 5, user: member('e', 'Mo'), value: '1095' },
    ],
    empty: 'No scores yet this season.',
    footer: <Link to='/games/spread-pool/entries'>My entries</Link>,
  },
};

/** Rows that are not a ranking, such as survivor pools. */
export const Unranked: Story = {
  args: {
    title: 'Survivor',
    to: '/games/survivor',
    rows: [
      { key: 'p1', label: 'FlexSpot 2026 Part 1', value: '14 of 52 alive' },
      { key: 'p2', label: 'FlexSpot 2026 Part 2', value: 'Not started' },
    ],
    empty: 'No pools yet.',
  },
};

export const Empty: Story = {
  args: {
    title: 'DFS survivor',
    to: '/games/dfs-survivor',
    status: 'No weeks scored yet',
    rows: [],
    empty: 'No scores yet this season.',
  },
};
