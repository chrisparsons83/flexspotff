import MemberAvatar from './MemberAvatar';
import MemberName from './MemberName';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof MemberAvatar> = {
  title: 'Primitives/Avatar',
  component: MemberAvatar,
};
export default meta;

type Story = StoryObj<typeof MemberAvatar>;

/** Discord's default avatar stands in, as it does for anyone without one. */
const member = { discordId: 'legacy:panda', discordAvatar: '' };

export const Sizes: Story = {
  render: () => (
    <div className='flex items-end gap-4'>
      {[24, 32, 48, 64, 96].map(size => (
        <MemberAvatar key={size} user={member} size={size} alt='Panda' />
      ))}
    </div>
  ),
};

/** Beside a name, the way a table row shows a member. */
export const WithName: Story = {
  name: 'With a name',
  render: () => (
    <span className='flex items-center gap-3'>
      <MemberAvatar user={member} size={32} />
      <MemberName
        className='font-semibold'
        user={{ discordName: 'Panda', discordUsername: 'pandabair' }}
      />
    </span>
  ),
};

/** Still loading, or nothing to show: the ground behind the image. */
export const Empty: Story = {
  render: () => <span className='block size-16 bg-secondary' />,
};
