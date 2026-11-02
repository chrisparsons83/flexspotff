import { Button } from './button';
import { EmptyState } from './empty-state';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof EmptyState> = {
  title: 'Data Display/EmptyState',
  component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'No Picks This Week',
    children: 'Lines for week 7 go up on Tuesday.',
  },
};

export const WithAnAction: Story = {
  name: 'With an action',
  args: {
    title: 'You Have No Entry for This Season',
    children: 'Entries close when the first game kicks off.',
    action: <Button>Make an Entry</Button>,
  },
};
