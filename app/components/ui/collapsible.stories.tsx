import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './collapsible';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Collapsible> = {
  title: 'Primitives/Collapsible',
  component: Collapsible,
};
export default meta;

type Story = StoryObj<typeof Collapsible>;

const Rows = () => (
  <CollapsibleContent>
    <ol className='grid gap-2 pb-3'>
      <li>2023, Galaxy, 4th of 12</li>
      <li>2022, Galaxy, 7th of 12</li>
      <li>2021, Dragon, 1st of 12</li>
    </ol>
  </CollapsibleContent>
);

export const Closed: Story = {
  render: () => (
    <Collapsible className='max-w-md border-y border-border'>
      <CollapsibleTrigger>Earlier seasons</CollapsibleTrigger>
      <Rows />
    </Collapsible>
  ),
};

export const Open: Story = {
  render: () => (
    <Collapsible defaultOpen className='max-w-md border-y border-border'>
      <CollapsibleTrigger>Earlier seasons</CollapsibleTrigger>
      <Rows />
    </Collapsible>
  ),
};
