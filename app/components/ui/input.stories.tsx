import { Field } from './field';
import { Input, Textarea } from './input';
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
      <Field label='Team name'>
        <Input defaultValue='Mahomes Alone' />
      </Field>
      <Field
        label='Sleeper username'
        description='The name you sign in to Sleeper with, not your display name.'
      >
        <Input placeholder='username' />
      </Field>
      <Field label='Week' error='Week has to be between 1 and 18.'>
        <Input type='number' defaultValue={19} />
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
    </div>
  ),
};

export const OnACard: Story = {
  name: 'On a card',
  render: () => (
    <div className='max-w-sm bg-card p-6'>
      <Field label='Team name'>
        <Input defaultValue='Mahomes Alone' />
      </Field>
    </div>
  ),
};
