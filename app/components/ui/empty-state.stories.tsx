import { Button } from './button';
import { EmptyState } from './empty-state';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof EmptyState> = {
  title: 'Data display/EmptyState',
  component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: {
    title: 'No picks this week',
    children: 'Lines for week 7 go up on Tuesday.',
  },
};

export const WithAnAction: Story = {
  name: 'With an action',
  args: {
    title: 'You have no entry for this season',
    children: 'Entries close when the first game kicks off.',
    action: <Button>Make an entry</Button>,
  },
};
