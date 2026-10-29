import { Button } from './button';
import { Cross2Icon, DiscordLogoIcon } from '@radix-ui/react-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Make your pick' },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: [
        'primary',
        'secondary',
        'destructive',
        'discord',
        'ghost',
        'link',
      ],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg', 'icon'] },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {};

export const Variants: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4'>
      <Button>Save</Button>
      <Button variant='secondary'>Cancel</Button>
      <Button variant='destructive'>Delete Entry</Button>
      <Button variant='discord'>
        <DiscordLogoIcon aria-hidden />
        Join the Discord
      </Button>
      <Button variant='ghost'>Show More</Button>
      <Button variant='link'>Rules</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4'>
      <Button size='sm'>Small</Button>
      <Button size='md'>Medium</Button>
      <Button size='lg'>Large</Button>
    </div>
  ),
};

/** Only where the icon replaces a word the reader would otherwise read. */
export const IconOnly: Story = {
  name: 'Icon only',
  render: () => (
    <Button variant='ghost' size='icon' aria-label='Close'>
      <Cross2Icon aria-hidden />
    </Button>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className='flex flex-wrap items-center gap-4'>
      <Button disabled>Save</Button>
      <Button variant='secondary' disabled>
        Cancel
      </Button>
    </div>
  ),
};

export const OnACard: Story = {
  name: 'On a card',
  render: () => (
    <div className='flex flex-wrap gap-4 bg-card p-6'>
      <Button>Save</Button>
      <Button variant='secondary'>Cancel</Button>
    </div>
  ),
};
