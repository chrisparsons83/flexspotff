import { SegmentedControl, YearFilter } from './segmented-control';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof SegmentedControl> = {
  title: 'Primitives/SegmentedControl',
  component: SegmentedControl,
};
export default meta;

type Story = StoryObj<typeof SegmentedControl>;

export const Default: Story = {
  render: function Render() {
    const [value, setValue] = useState('points');
    return (
      <SegmentedControl
        label='Sort by'
        value={value}
        onChange={setValue}
        options={[
          { value: 'points', label: 'Points' },
          { value: 'record', label: 'Record' },
          { value: 'name', label: 'Name' },
        ]}
      />
    );
  },
};

export const Years: Story = {
  render: function Render() {
    const [value, setValue] = useState<number | 'all'>(2026);
    return (
      <YearFilter
        years={[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]}
        value={value}
        onChange={setValue}
      />
    );
  },
};
