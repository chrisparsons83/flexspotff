import { WinLoss } from './win-loss';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof WinLoss> = {
  title: 'Data display/WinLoss',
  component: WinLoss,
  args: { wins: 9, losses: 4 },
};
export default meta;

type Story = StoryObj<typeof WinLoss>;

export const Default: Story = {};

export const WithTies: Story = { name: 'With ties', args: { ties: 1 } };

/** At display size, where the numbers carry the weight. */
export const Display: Story = {
  render: args => (
    <span className='text-4xl font-extrabold'>
      <WinLoss {...args} />
    </span>
  ),
};
