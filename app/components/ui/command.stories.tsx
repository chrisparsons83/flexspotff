import MemberSelect from './MemberSelect';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Command> = {
  title: 'Primitives/Command',
  component: Command,
};
export default meta;

type Story = StoryObj<typeof Command>;

const MEMBERS = [
  { id: '1', discordName: 'Panda', discordUsername: 'pandabair' },
  { id: '2', discordName: 'Lucky', discordUsername: 'lucky' },
  { id: '3', discordName: 'Gridiron Gus', discordUsername: 'gus' },
  {
    id: '4',
    discordName: 'Kat',
    discordUsername: 'katherine',
    pastNames: ['Kitty'],
  },
];

export const Default: Story = {
  render: () => (
    <Command className='max-w-sm' label='Go to'>
      <CommandInput placeholder='Go to' />
      <CommandList>
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandGroup heading='Leagues'>
          <CommandItem>Standings</CommandItem>
          <CommandItem>Leaderboard</CommandItem>
          <CommandItem>Cup</CommandItem>
        </CommandGroup>
        <CommandGroup heading='Games'>
          <CommandItem>Spread pool</CommandItem>
          <CommandItem>QB streaming</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

/** The member picker admin forms use, built on Command and Popover. */
export const MemberPicker: Story = {
  name: 'Member picker',
  render: () => <MemberSelect name='userId' members={MEMBERS} />,
};
