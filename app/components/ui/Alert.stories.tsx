import Alert from './Alert';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Alert> = {
  title: 'Primitives/Alert',
  component: Alert,
};
export default meta;

type Story = StoryObj<typeof Alert>;

export const States: Story = {
  render: () => (
    <div className='grid max-w-lg gap-4'>
      <Alert status='success' message='Picks saved for week 6.' />
      <Alert
        status='warning'
        message='Two games kick off before the deadline.'
      />
      <Alert
        status='error'
        message='The spread for this game changed. Pick again.'
      />
    </div>
  ),
};
