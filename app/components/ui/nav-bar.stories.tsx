import { NavBar } from './nav-bar';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent, within } from 'storybook/test';

const MEMBER = {
  discordName: 'Panda',
  discordId: 'legacy:panda',
  discordAvatar: '',
};

const meta: Meta<typeof NavBar> = {
  title: 'Layout/NavBar',
  component: NavBar,
  parameters: { layout: 'fullscreen', remix: { path: '/games/spread-pool' } },
  args: { user: MEMBER, isEditor: true, canViewProfiles: true },
};
export default meta;

type Story = StoryObj<typeof NavBar>;

/** Inside Games, so Games is marked though this is not its landing page. */
export const InASection: Story = { name: 'In a section' };

export const SignedOut: Story = { name: 'Signed out', args: { user: null } };

/** With the theme toggle, as #197 will show it. */
export const WithThemeToggle: Story = {
  name: 'With the theme toggle',
  args: { theme: 'system' },
};

export const PhoneClosed: Story = {
  name: 'Phone',
  globals: { viewport: { value: 'mobile2' }, theme: 'dark' },
};

export const PhoneOpen: Story = {
  name: 'Phone, menu open',
  globals: { viewport: { value: 'mobile2' }, theme: 'dark' },
  args: { theme: 'dark' },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole('button', { name: 'Menu' }),
    );
  },
};
