import { PlayerLabel } from './player-label';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof PlayerLabel> = {
  title: 'Primitives/PlayerLabel',
  component: PlayerLabel,
};
export default meta;

type Story = StoryObj<typeof PlayerLabel>;

export const Default: Story = {
  args: { player: { name: 'Puka Nacua', position: 'WR', nflTeam: 'LAR' } },
};

export const NoTeam: Story = {
  name: 'Without a team',
  args: { player: { name: 'Free agent', position: 'RB', nflTeam: null } },
};
