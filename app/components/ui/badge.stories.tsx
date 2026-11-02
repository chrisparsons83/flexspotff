import { Badge } from './badge';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Badge> = {
  title: 'Primitives/Badge',
  component: Badge,
  args: { fill: 'medal-gold', label: 'League Champion', mark: '2024' },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className='flex flex-wrap items-start gap-8'>
      <Badge size='sm' fill='medal-gold' label='League Champion' />
      <Badge size='md' fill='medal-gold' label='League Champion' mark='2024' />
      <Badge size='lg' fill='medal-gold' label='League Champion' mark='2024' />
    </div>
  ),
};

/**
 * A member's honours on the grid. Titles are gold, the top tier's title is
 * the Champions colour, the sacko is its own medal, and banded awards step
 * through the value sequence by tier.
 */
export const Honours: Story = {
  render: () => (
    <ul className='grid grid-cols-3 gap-6 sm:grid-cols-6'>
      <li>
        <Badge
          fill='league-champions'
          label='Champion of Champions'
          mark='1'
          detail='2021'
        />
      </li>
      <li>
        <Badge
          fill='medal-gold'
          label='League Champion'
          mark='3'
          detail='Titles'
        />
      </li>
      <li>
        <Badge fill='medal-gold' label='Cup Champion' mark='1' detail='2023' />
      </li>
      <li>
        <Badge fill='medal-sacko' label='Sacko' mark='2' detail='Last places' />
      </li>
      <li>
        <Badge
          fill='sequence-5'
          label='Seasons Played'
          mark='8'
          detail='Tier 2 of 3'
        />
      </li>
      <li>
        <Badge
          fill='sequence-7'
          label='Win Streak'
          mark='9'
          detail='Tier 3 of 3'
        />
      </li>
    </ul>
  ),
};

/** A single status beside a heading or in a row, at the smallest size. */
export const Status: Story = {
  render: () => (
    <div className='grid gap-3'>
      <Badge size='sm' fill='primary' label='Registration Open' />
      <Badge size='sm' fill='medal-sacko' label='Eliminated in Week 9' />
    </div>
  ),
};
