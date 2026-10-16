import { Grid, GridItem } from './grid';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Grid> = {
  title: 'Layout/Grid',
  component: Grid,
};
export default meta;

type Story = StoryObj<typeof Grid>;

const Block = ({ children }: { children: string }) => (
  <div className='bg-card p-4 text-sm'>{children}</div>
);

export const Spans: Story = {
  render: () => (
    <Grid>
      <GridItem span={{ md: 8 }}>
        <Block>8 of 12 from md</Block>
      </GridItem>
      <GridItem span={{ md: 4 }}>
        <Block>4 of 12 from md</Block>
      </GridItem>
      {[1, 2, 3, 4].map(n => (
        <GridItem key={n} span={{ base: 6, lg: 3 }}>
          <Block>6, then 3 from lg</Block>
        </GridItem>
      ))}
      <GridItem>
        <Block>12</Block>
      </GridItem>
    </Grid>
  ),
};
