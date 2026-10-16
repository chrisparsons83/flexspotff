import { StatList } from './stat-list';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof StatList> = {
  title: 'Data display/StatList',
  component: StatList,
};
export default meta;

type Story = StoryObj<typeof StatList>;

export const Default: Story = {
  args: {
    stats: [
      { label: 'Seasons', value: 8 },
      { label: 'Titles', value: 2 },
      { label: 'Record', value: '71–41' },
      { label: 'Win rate', value: '63%' },
      { label: 'Playoffs', value: 6 },
      { label: 'Best finish', value: '1st' },
    ],
  },
};

export const FourAcross: Story = {
  name: 'Four across',
  args: {
    className: 'grid-cols-2 md:grid-cols-4',
    stats: [
      { label: 'Claims won', value: 42 },
      { label: 'Bids that lost', value: 17 },
      { label: 'FAAB spent', value: '$612' },
      { label: 'Budget each', value: '$100' },
    ],
  },
};
