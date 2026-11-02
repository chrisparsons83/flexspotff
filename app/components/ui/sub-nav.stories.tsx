import { SubNav } from './sub-nav';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof SubNav> = {
  title: 'Layout/SubNav',
  component: SubNav,
  parameters: { remix: { path: '/side-leagues/guillotine/12/draft' } },
  args: {
    label: 'Guillotine',
    items: [
      { label: 'Standings', to: '/side-leagues/guillotine/12', end: true },
      { label: 'Weeks', to: '/side-leagues/guillotine/12/week/1' },
      { label: 'Draft', to: '/side-leagues/guillotine/12/draft' },
      { label: 'Waivers', to: '/side-leagues/guillotine/12/waivers' },
      { label: 'History', to: '/side-leagues/guillotine' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof SubNav>;

/** The shared game sub-navigation, on the Draft tab. */
export const Default: Story = {};

/** A side league without weeks or waivers leaves those tabs out. */
export const FewerTabs: Story = {
  name: 'Fewer tabs',
  parameters: { remix: { path: '/side-leagues/best-ball/2025' } },
  args: {
    label: 'Autodraft BBM',
    items: [
      { label: 'Standings', to: '/side-leagues/best-ball/2025', end: true },
      { label: 'Draft', to: '/side-leagues/best-ball/2025/draft' },
      { label: 'History', to: '/side-leagues/best-ball' },
    ],
  },
};

export const Phone: Story = {
  globals: { viewport: { value: 'mobile2' }, theme: 'dark' },
};
