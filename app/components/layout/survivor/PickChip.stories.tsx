import PickChip from './PickChip';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof PickChip> = {
  title: 'Data/PickChip',
  component: PickChip,
};
export default meta;

type Story = StoryObj<typeof PickChip>;

/** Every state a week of a survivor entry can be in. */
export const States: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-3'>
      <PickChip cell={{ kind: 'pick', team: 'DET', result: 'WIN' }} />
      <PickChip cell={{ kind: 'pick', team: 'KC', result: 'LOSS' }} />
      <PickChip cell={{ kind: 'pick', team: 'BUF', result: 'PENDING' }} />
      <PickChip cell={{ kind: 'missed' }} />
      <PickChip cell={{ kind: 'none' }} />
    </div>
  ),
};
