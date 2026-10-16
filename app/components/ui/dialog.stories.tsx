import { Button } from './button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Dialog> = {
  title: 'Primitives/Dialog',
  component: Dialog,
};
export default meta;

type Story = StoryObj<typeof Dialog>;

const Body = () => (
  <>
    <DialogHeader>
      <DialogTitle>Delete this entry</DialogTitle>
      <DialogDescription>
        Your week 6 lineup goes, and you can enter a new one until kickoff.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <DialogClose asChild>
        <Button variant='secondary'>Keep it</Button>
      </DialogClose>
      <Button variant='destructive'>Delete</Button>
    </DialogFooter>
  </>
);

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant='secondary'>Delete entry</Button>
      </DialogTrigger>
      <DialogContent>
        <Body />
      </DialogContent>
    </Dialog>
  ),
};

/**
 * Open, so it can be reviewed. It opens outside the story, in the theme set
 * on the page, so switch the toolbar to Dark or Light.
 */
export const Open: Story = {
  render: () => (
    <Dialog defaultOpen>
      <DialogContent>
        <Body />
      </DialogContent>
    </Dialog>
  ),
};
