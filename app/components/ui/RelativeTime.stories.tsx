import RelativeTime from './RelativeTime';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof RelativeTime> = {
  title: 'Primitives/RelativeTime',
  component: RelativeTime,
};
export default meta;

type Story = StoryObj<typeof RelativeTime>;

const fromNow = (ms: number) => new Date(Date.now() + ms);

/** How far off a deadline is, with the exact time on hover. */
export const Range: Story = {
  render: () => (
    <ul className='grid gap-2'>
      <li>
        <RelativeTime value={fromNow(40 * 60_000)} />
      </li>
      <li>
        <RelativeTime value={fromNow(5 * 3_600_000)} />
      </li>
      <li>
        <RelativeTime value={fromNow(26 * 3_600_000)} />
      </li>
      <li>
        <RelativeTime value={fromNow(4 * 86_400_000)} />
      </li>
      <li>
        <RelativeTime value={fromNow(12 * 86_400_000)} />
      </li>
    </ul>
  ),
};
