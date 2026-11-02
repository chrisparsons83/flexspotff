import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Popover> = {
  title: 'Primitives/Popover',
  component: Popover,
};
export default meta;

type Story = StoryObj<typeof Popover>;

const Content = () => (
  <>
    <p className='font-semibold'>Waivers</p>
    <p className='mt-1 text-muted-foreground'>
      Claims run Wednesday at 6 am Eastern, lowest bid first.
    </p>
  </>
);

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='secondary'>Waivers</Button>
      </PopoverTrigger>
      <PopoverContent>
        <Content />
      </PopoverContent>
    </Popover>
  ),
};

export const Open: Story = {
  render: () => (
    <div className='h-48'>
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <Button variant='secondary'>Waivers</Button>
        </PopoverTrigger>
        <PopoverContent>
          <Content />
        </PopoverContent>
      </Popover>
    </div>
  ),
};
