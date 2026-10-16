import { Label } from './label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
};
export default meta;

type Story = StoryObj<typeof Select>;

const LEAGUES = ['Admiral', 'Champions', 'Dragon', 'Galaxy', 'Monarch'];

export const Default: Story = {
  render: () => (
    <div className='grid max-w-xs gap-2'>
      <Label htmlFor='league'>League</Label>
      <Select name='league'>
        <SelectTrigger id='league'>
          <SelectValue placeholder='Choose a league' />
        </SelectTrigger>
        <SelectContent>
          {LEAGUES.map(league => (
            <SelectItem key={league} value={league.toLowerCase()}>
              {league}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  ),
};

/** Open, so the list is reviewed in the theme set on the page. */
export const Open: Story = {
  render: () => (
    <div className='grid h-80 max-w-xs content-start gap-2'>
      <Label htmlFor='season'>Season</Label>
      <Select name='season' defaultValue='2025' defaultOpen>
        <SelectTrigger id='season'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Current</SelectLabel>
            <SelectItem value='2026'>2026</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Past</SelectLabel>
            {['2025', '2024', '2023'].map(year => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
};
