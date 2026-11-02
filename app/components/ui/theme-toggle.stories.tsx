import { ThemeToggle } from './theme-toggle';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ThemeToggle> = {
  title: 'Primitives/ThemeToggle',
  component: ThemeToggle,
};
export default meta;

type Story = StoryObj<typeof ThemeToggle>;

export const Default: Story = {};

export const InTheNav: Story = {
  name: 'In the nav',
  render: args => (
    <div className='flex justify-end bg-card p-3'>
      <ThemeToggle {...args} />
    </div>
  ),
};
