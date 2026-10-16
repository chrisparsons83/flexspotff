import {
  rankTone,
  ScaleKey,
  WeekGrid,
  type WeekGridCell,
  type WeekGridRow,
  WeekLegend,
  WonKey,
} from './week-grid';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof WeekGrid> = {
  title: 'Data display/WeekGrid',
  component: WeekGrid,
};
export default meta;

type Story = StoryObj<typeof WeekGrid>;

const FIELD = 12;

/** A made-up but steady career: the same seed gives the same grid. */
const rows: WeekGridRow[] = [2026, 2025, 2024, 2023].map((year, y) => ({
  year,
  weeks: new Map(
    Array.from({ length: year === 2026 ? 6 : 14 }, (_, i) => {
      const week = i + 1;
      const rank = ((week * 7 + y * 5) % FIELD) + 1;
      const points = 160 - rank * 7;
      const cell: WeekGridCell = {
        value: points,
        title: `${year}, week ${week}: ${points} points, ${rank} of ${FIELD}`,
        tone: rankTone(rank, FIELD),
        won: rank === 1,
      };
      return [week, cell] as const;
    }),
  ),
}));

export const Default: Story = {
  args: { rows, lastWeek: 14 },
  render: args => (
    <>
      <WeekGrid {...args} />
      <WeekLegend>
        <ScaleKey />
        <WonKey sample='153' />
      </WeekLegend>
    </>
  ),
};

/** One season at a time, its weeks wrapped, each square numbered. */
export const OnAPhone: Story = {
  name: 'On a phone',
  globals: { viewport: { value: 'mobile2' }, theme: 'dark' },
  args: { rows, lastWeek: 14 },
};
