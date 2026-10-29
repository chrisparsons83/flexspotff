import { Button } from './button';
import { PageHeader } from './page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { SubNav } from './sub-nav';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof PageHeader> = {
  title: 'Layout/PageHeader',
  component: PageHeader,
  parameters: { remix: { path: '/games/spread-pool/standings' } },
};
export default meta;

type Story = StoryObj<typeof PageHeader>;

const GAME_TABS = [
  { label: 'Overview', to: '/games/spread-pool', end: true },
  { label: 'Standings', to: '/games/spread-pool/standings' },
  { label: 'My Entries', to: '/games/spread-pool/entries' },
  { label: 'Rules', to: '/games/spread-pool/rules' },
  { label: 'History', to: '/games/spread-pool/history' },
];

export const TitleOnly: Story = {
  name: 'Title only',
  args: { title: 'Records' },
};

export const WithDescription: Story = {
  name: 'With a description',
  args: {
    title: 'Spread Pool',
    description: 'Pick every game against the spread. One point a win.',
  },
};

export const WithActionsAndNav: Story = {
  name: 'With actions and sub-navigation',
  args: {
    title: 'Spread Pool',
    description: 'Pick every game against the spread. One point a win.',
    actions: <Button>Make Your Picks</Button>,
    nav: <SubNav label='Spread Pool' items={GAME_TABS} />,
  },
};

/** A league's pages, with the picker for the five leagues. */
export const LeagueWithPicker: Story = {
  name: 'League, with the picker',
  parameters: { remix: { path: '/leagues/2026/admiral' } },
  args: {
    title: 'Admiral',
    nav: (
      <SubNav
        label='Admiral'
        items={[
          { label: 'Standings', to: '/leagues/2026/admiral', end: true },
          { label: 'Matchups', to: '/leagues/2026/admiral/matchups' },
          { label: 'Playoffs', to: '/leagues/2026/admiral/playoffs' },
          { label: 'Draft', to: '/leagues/2026/admiral/draft' },
          { label: 'Transactions', to: '/leagues/2026/admiral/transactions' },
        ]}
        picker={
          <Select defaultValue='admiral'>
            <SelectTrigger className='w-44' aria-label='League'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Admiral', 'Champions', 'Dragon', 'Galaxy', 'Monarch'].map(
                league => (
                  <SelectItem key={league} value={league.toLowerCase()}>
                    {league}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        }
      />
    ),
  },
};
