import { Field } from './field';
import { Checkbox, Input, NativeSelect, Textarea } from './input';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: () => (
    <div className='grid max-w-sm gap-6'>
      <Field label='Team Name'>
        <Input defaultValue='Mahomes Alone' />
      </Field>
      <Field
        label='Sleeper Username'
        description='The name you sign in to Sleeper with, not your display name.'
      >
        <Input placeholder='username' />
      </Field>
      <Field label='Week' error='Week has to be between 1 and 18.'>
        <Input type='number' defaultValue={19} />
      </Field>
      <Field label='Week'>
        <NativeSelect defaultValue='3'>
          <option value='all'>All Weeks</option>
          <option value='3'>Week 3</option>
          <option value='2'>Week 2</option>
        </NativeSelect>
      </Field>
      <Field label='Notes'>
        <Textarea defaultValue='Waivers run Wednesday morning.' />
      </Field>
      <Field label='Archive'>
        <Input type='file' />
      </Field>
      <Field label='Locked'>
        <Input disabled defaultValue='2025' />
      </Field>
      <label className='flex items-center gap-3'>
        <Checkbox defaultChecked />
        Mark as scored
      </label>
    </div>
  ),
};

export const OnACard: Story = {
  name: 'On a card',
  render: () => (
    <div className='max-w-sm bg-card p-6'>
      <Field label='Team Name'>
        <Input defaultValue='Mahomes Alone' />
      </Field>
    </div>
  ),
};
