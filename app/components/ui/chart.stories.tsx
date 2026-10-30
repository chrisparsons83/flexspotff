import { ChartKey, ChartKeys } from './chart';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ChartKeys> = {
  title: 'Data Display/ChartKey',
  component: ChartKeys,
};
export default meta;

type Story = StoryObj<typeof ChartKeys>;

/** The key under a chart: a sample of each mark, then what it is. */
export const Default: Story = {
  render: () => (
    <p className='text-sm text-muted-foreground'>
      <ChartKeys>
        <ChartKey>
          <span className='inline-block w-4 border-t-2 border-primary' />
          Their points
        </ChartKey>
        <ChartKey>
          <span className='inline-block h-2.5 w-4 bg-muted-foreground/30' />
          Middle half of the field
        </ChartKey>
        <ChartKey>
          <span className='inline-block w-4 border-t border-dashed border-muted-foreground' />
          Median
        </ChartKey>
      </ChartKeys>
    </p>
  ),
};
