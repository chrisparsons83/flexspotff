import { Button } from './button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from './tooltip';
import { Cross2Icon } from '@radix-ui/react-icons';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Tooltip> = {
  title: 'Primitives/Tooltip',
  component: Tooltip,
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

/** Naming a control that shows only an icon. */
export const IconControl: Story = {
  name: 'Icon control',
  render: () => (
    <Tooltip content='Remove player'>
      <Button variant='ghost' size='icon' aria-label='Remove player'>
        <Cross2Icon aria-hidden />
      </Button>
    </Tooltip>
  ),
};

/** The whole of a name cut short. */
export const Truncated: Story = {
  render: () => (
    <div className='h-20 pt-10'>
      <TooltipProvider>
        <TooltipRoot defaultOpen>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className='inline-block max-w-[8rem] truncate align-bottom'
            >
              #TrustTheProcessForever
            </span>
          </TooltipTrigger>
          <TooltipContent>#TrustTheProcessForever</TooltipContent>
        </TooltipRoot>
      </TooltipProvider>
    </div>
  ),
};
