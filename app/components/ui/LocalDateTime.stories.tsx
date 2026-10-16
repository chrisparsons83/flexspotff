import LocalDateTime from './LocalDateTime';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof LocalDateTime> = {
  title: 'Data display/LocalDateTime',
  component: LocalDateTime,
  args: { value: '2026-10-18T17:00:00Z' },
};
export default meta;

type Story = StoryObj<typeof LocalDateTime>;

/** In the viewer's own zone once the page is running. */
export const Default: Story = {};

export const Deadline: Story = {
  render: args => (
    <p>
      Picks lock{' '}
      <LocalDateTime
        {...args}
        options={{
          weekday: 'long',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        }}
      />
      .
    </p>
  ),
};

export const DateOnly: Story = {
  name: 'Date only',
  args: { options: { dateStyle: 'medium' } },
};
