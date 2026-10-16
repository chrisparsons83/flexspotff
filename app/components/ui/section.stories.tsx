import { Section } from './section';
import { YearFilter } from './segmented-control';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Section> = {
  title: 'Layout/Section',
  component: Section,
};
export default meta;

type Story = StoryObj<typeof Section>;

export const Default: Story = {
  args: {
    title: 'Game log',
    description: 'Every matchup, newest first.',
    children: <p>The table goes here.</p>,
  },
};

export const WithActionAndFootnote: Story = {
  name: 'With an action and a footnote',
  args: {
    title: 'Game log',
    description: 'Every matchup, newest first.',
    action: (
      <YearFilter years={[2026, 2025, 2024]} value={2026} onChange={() => {}} />
    ),
    footnote: 'Points before 2020 are from half-PPR scoring.',
    children: <p>The table goes here.</p>,
  },
};

/** Two sections in a row, set apart by space alone. */
export const Stacked: Story = {
  render: () => (
    <>
      <Section title='This season'>
        <p>Standings.</p>
      </Section>
      <Section title='All time'>
        <p>Records.</p>
      </Section>
    </>
  ),
};
