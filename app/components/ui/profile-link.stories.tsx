import { ProfileLink } from './profile-link';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ProfileLink> = {
  title: 'Primitives/ProfileLink',
  component: ProfileLink,
  args: { userId: 'u1', children: 'Panda' },
};
export default meta;

type Story = StoryObj<typeof ProfileLink>;

/** A member's name links to their profile when the reader can open it. */
export const CanViewProfiles: Story = {
  name: 'Can view profiles',
  parameters: {
    remix: {
      rootData: { canViewProfiles: true, profileHandles: { u1: 'panda' } },
    },
  },
};

/** Plain text for anyone who cannot, so nothing links to a 404. */
export const CannotViewProfiles: Story = {
  name: 'Cannot view profiles',
  parameters: {
    remix: { rootData: { canViewProfiles: false, profileHandles: {} } },
  },
};
