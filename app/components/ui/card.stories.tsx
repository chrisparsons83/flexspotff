import { Card, CardContent, CardHeader, CardTitle } from './card';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Card> = {
  title: 'Layout/Card',
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className='max-w-sm'>
      <CardHeader>
        <CardTitle>Your week</CardTitle>
      </CardHeader>
      <CardContent>
        Spread pool picks lock Sunday at 1:00 pm Eastern.
      </CardContent>
    </Card>
  ),
};

/** A league's card wears its tint, with its colour across the header. */
export const Leagues: Story = {
  render: () => (
    <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-5'>
      {(['admiral', 'champions', 'dragon', 'galaxy', 'monarch'] as const).map(
        league => (
          <Card key={league} league={`league-${league}`}>
            <CardHeader>
              <CardTitle className='capitalize'>{league}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className='grid gap-1'>
                <li>Panda, 9 and 2</li>
                <li>Lucky, 8 and 3</li>
              </ol>
            </CardContent>
          </Card>
        ),
      )}
    </div>
  ),
};

export const ContentOnly: Story = {
  name: 'Content only',
  render: () => (
    <Card className='max-w-sm'>
      <CardContent>A plain panel, one step up from the page.</CardContent>
    </Card>
  ),
};
