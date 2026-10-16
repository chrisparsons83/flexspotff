import GoBox from './GoBox';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Link } from '@remix-run/react';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Primitives/DropdownMenu',
  component: DropdownMenu,
};
export default meta;

type Story = StoryObj<typeof DropdownMenu>;

const Items = () => (
  <>
    <DropdownMenuItem asChild>
      <Link to='/dashboard'>Dashboard</Link>
    </DropdownMenuItem>
    <DropdownMenuItem asChild>
      <Link to='/me'>Profile</Link>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Log out</DropdownMenuItem>
  </>
);

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='secondary'>Account</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='start'>
        <Items />
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const Open: Story = {
  render: () => (
    <div className='h-48'>
      <DropdownMenu defaultOpen modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant='secondary'>Account</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start'>
          <Items />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ),
};

/** A list of pages behind a button, used for past seasons. */
export const PageList: Story = {
  name: 'Page list (GoBox)',
  render: () => (
    <GoBox
      buttonText='Past seasons'
      options={['2025', '2024', '2023'].map(year => ({
        label: year,
        url: `/leagues/standings/${year}`,
      }))}
    />
  ),
};
