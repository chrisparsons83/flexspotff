import { StatList } from './stat-list';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof StatList> = {
  title: 'Data Display/StatList',
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
      { label: 'Win Rate', value: '63%' },
      { label: 'Playoffs', value: 6 },
      { label: 'Best Finish', value: '1st' },
    ],
  },
};

export const FourAcross: Story = {
  name: 'Four across',
  args: {
    className: 'grid-cols-2 md:grid-cols-4',
    stats: [
      { label: 'Claims Won', value: 42 },
      { label: 'Bids That Lost', value: 17 },
      { label: 'FAAB Spent', value: '$612' },
      { label: 'Budget Each', value: '$100' },
    ],
  },
};
