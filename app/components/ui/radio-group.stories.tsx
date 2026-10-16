import { Label } from './label';
import { RadioGroup, RadioGroupItem } from './radio-group';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId } from 'react';

const meta: Meta<typeof RadioGroup> = {
  title: 'Primitives/RadioGroup',
  component: RadioGroup,
};
export default meta;

type Story = StoryObj<typeof RadioGroup>;

function Option({ value, label }: { value: string; label: string }) {
  const id = useId();
  return (
    <div className='flex items-center gap-3'>
      <RadioGroupItem value={value} id={id} />
      <Label htmlFor={id} className='text-base font-normal'>
        {label}
      </Label>
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <RadioGroup name='pick' defaultValue='home' aria-label='Pick'>
      <Option value='home' label='Bills, minus 3' />
      <Option value='away' label='Chiefs, plus 3' />
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup name='pick' defaultValue='home' aria-label='Pick' disabled>
      <Option value='home' label='Bills, minus 3' />
      <Option value='away' label='Chiefs, plus 3' />
    </RadioGroup>
  ),
};
