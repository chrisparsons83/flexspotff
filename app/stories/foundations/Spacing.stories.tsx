import {
  FoundationPage,
  FoundationSection,
  Name,
  TokenRow,
  TokenTable,
} from './parts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { GRID_UNIT } from '~/styles/tokens/scale';

const meta: Meta = {
  title: 'Foundations/Spacing',
};

export default meta;
type Story = StoryObj;

/** The steps in use, by Tailwind's name, each a count of grid units. */
const STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 24];

/** Written out so Tailwind sees each class. */
const WIDTH_CLASS: Record<number, string> = {
  1: 'w-1',
  2: 'w-2',
  3: 'w-3',
  4: 'w-4',
  6: 'w-6',
  8: 'w-8',
  12: 'w-12',
  16: 'w-16',
  24: 'w-24',
};

export const Scale: Story = {
  render: () => (
    <FoundationPage
      title='Spacing'
      intro={`Space comes from Tailwind's scale as it stands: one unit is ${GRID_UNIT}px, and every padding, gap and margin is a whole number of units. Line heights sit on the same grid.`}
    >
      <FoundationSection
        title='Scale'
        about='Empty space and the grid separate content, not borders or cards.'
      >
        <TokenTable columns={['Sample', 'Step', 'Size', 'Classes']}>
          {STEPS.map(step => (
            <TokenRow
              key={step}
              cells={[
                <span
                  key='s'
                  aria-hidden
                  className={`block h-4 bg-primary ${WIDTH_CLASS[step]}`}
                />,
                step,
                `${step * GRID_UNIT}px`,
                <Name key='c'>{`p-${step}  gap-${step}  m-${step}`}</Name>,
              ]}
            />
          ))}
        </TokenTable>
      </FoundationSection>
    </FoundationPage>
  ),
};
