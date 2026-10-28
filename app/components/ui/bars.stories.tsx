import {
  KeyedBar,
  LabelledRange,
  PercentileStrip,
  PositionBar,
  RangeBar,
  RankBar,
  SplitBar,
  TallyBars,
} from './bars';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = { title: 'Data display/Bars' };
export default meta;

type Story = StoryObj;

const Row = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className='grid gap-2'>
    <p className='text-sm text-muted-foreground'>{label}</p>
    {children}
  </div>
);

export const Rank: Story = {
  render: () => (
    <div className='grid max-w-md gap-6'>
      <Row label='Finish'>
        <RankBar rank={1} fieldSize={12} />
      </Row>
      <Row label='Finish'>
        <RankBar rank={5} fieldSize={12} />
      </Row>
      <Row label='Finish'>
        <RankBar rank={12} fieldSize={12} />
      </Row>
    </div>
  ),
};

export const Percentile: Story = {
  render: () => (
    <div className='grid max-w-md gap-6'>
      <Row label='Weekly finishes, bottom of the field to the top'>
        <PercentileStrip
          values={[0.1, 0.35, 0.4, 0.42, 0.6, 0.62, 0.65, 0.8, 0.95]}
          average={0.55}
        />
      </Row>
    </div>
  ),
};

export const Share: Story = {
  render: () => (
    <div className='grid max-w-md gap-6'>
      <Row label='Career record'>
        <SplitBar wins={52} losses={38} ties={1} />
      </Row>
      <Row label='How seasons ended'>
        <KeyedBar
          entries={[
            { label: 'Won', count: 2, tone: 'medal-gold' },
            { label: 'Top 3', count: 3, tone: 'sequence-6' },
            { label: 'Top 5', count: 2, tone: 'sequence-4' },
            { label: '6th+', count: 4, tone: 'sequence-2' },
          ]}
        />
      </Row>
    </div>
  ),
};

export const Range: Story = {
  render: () => (
    <div className='grid max-w-md gap-6'>
      <Row label='Average week, between the worst and the best'>
        <RangeBar low={62.4} high={171.8} mark={118.2} />
      </Row>
      <Row label='Weekly points'>
        <LabelledRange
          low={62.4}
          high={171.8}
          mark={118.2}
          lowLabel='worst'
          highLabel='best'
          format={value => value.toFixed(1)}
        />
      </Row>
    </div>
  ),
};

/** A roster by position, with a fainter comparison bar under it. */
export const Positions: Story = {
  render: () => (
    <div className='grid max-w-md grid-cols-[5rem_1fr] items-center gap-x-3 gap-y-1 text-sm text-muted-foreground'>
      <span>Drafted</span>
      <PositionBar counts={{ QB: 3, RB: 6, WR: 7, TE: 2 }} />
      <span>League</span>
      <PositionBar counts={{ QB: 2, RB: 6, WR: 8, TE: 2 }} size='small' />
    </div>
  ),
};

/** How many chose each option, with what it scored beside the count. */
export const Tallies: Story = {
  render: () => (
    <div className='max-w-md'>
      <TallyBars
        tallies={[
          { key: 'a', label: 'Bo Nix', count: 9, detail: '24.30 pts' },
          { key: 'b', label: 'Caleb Williams', count: 6, detail: '17.12 pts' },
          { key: 'c', label: 'Daniel Jones', count: 3, detail: '8.40 pts' },
          { key: 'd', label: 'Justin Fields', count: 1, detail: '21.86 pts' },
        ]}
      />
    </div>
  ),
};
