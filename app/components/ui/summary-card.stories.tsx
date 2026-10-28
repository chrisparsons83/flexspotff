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
    statusHref: '/games/spread-pool/entries/week-8',
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

/** The top and bottom of a guillotine week, with the cut marked. */
export const WithACut: Story = {
  name: 'With a cut',
  args: {
    title: 'Guillotine for the People',
    to: '/side-leagues/guillotine/abc',
    status: '14 of 18 alive after week 4. The cut was 47.94.',
    rows: [
      { key: '1', rank: 1, label: 'Fool', value: '138.20' },
      { key: '2', rank: 2, label: 'TheDu', value: '131.06' },
      { key: '3', rank: 3, label: 'Noro', value: '127.40' },
      {
        key: '13',
        rank: 13,
        label: 'eddieg0048',
        value: '76.86',
        divider: 'gap',
      },
      { key: '14', rank: 14, label: 'Ender', value: '64.18' },
      {
        key: '15',
        rank: 15,
        label: 'Fire Jerry into the Sun',
        value: '47.94',
        divider: 'cut',
        tone: 'negative',
      },
    ],
    empty: 'No scores for the week yet.',
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
