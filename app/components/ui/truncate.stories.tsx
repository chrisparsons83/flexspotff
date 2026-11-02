import { Truncate } from './truncate';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Truncate> = {
  title: 'Primitives/Truncate',
  component: Truncate,
};
export default meta;

type Story = StoryObj<typeof Truncate>;

export const LongName: Story = {
  name: 'A long name',
  args: {
    title: '#TrustTheProcessForeverAndEver',
    children: '#TrustTheProcessForeverAndEver',
  },
};

export const ShortName: Story = {
  name: 'A name that fits',
  args: { title: 'Panda', children: 'Panda' },
};
