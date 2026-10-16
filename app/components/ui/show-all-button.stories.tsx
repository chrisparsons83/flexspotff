import { ShowAllButton } from './show-all-button';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof ShowAllButton> = {
  title: 'Primitives/ShowAllButton',
  component: ShowAllButton,
};
export default meta;

type Story = StoryObj<typeof ShowAllButton>;

const OPPONENTS = Array.from({ length: 12 }, (_, i) => `Opponent ${i + 1}`);

export const Default: Story = {
  render: function Render() {
    const [showAll, setShowAll] = useState(false);
    return (
      <>
        <ol className='grid gap-1'>
          {(showAll ? OPPONENTS : OPPONENTS.slice(0, 4)).map(name => (
            <li key={name}>{name}</li>
          ))}
        </ol>
        <ShowAllButton
          total={OPPONENTS.length}
          noun='opponents'
          showAll={showAll}
          onToggle={() => setShowAll(value => !value)}
        />
      </>
    );
  },
};
