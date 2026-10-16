import { FoundationPage, FoundationSection } from './parts';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Foundations/Grid',
};

export default meta;
type Story = StoryObj;

const COLUMNS = Array.from({ length: 12 }, (_, i) => i + 1);

/** A shaded block spanning some columns, labelled with its span. */
function Span({ className, label }: { className: string; label: string }) {
  return (
    <div className={`bg-card px-3 py-4 text-sm ${className}`}>{label}</div>
  );
}

export const Columns: Story = {
  render: () => (
    <FoundationPage
      title='Grid'
      intro='Pages sit on twelve columns with 24px gutters (gap-x-6), in a frame at most 1152px wide (max-w-6xl) with 16px margins (px-4). The reference mocks are built on it.'
    >
      <FoundationSection
        title='Columns'
        about='Resize the canvas to see the columns hold their gutters.'
      >
        <div className='grid grid-cols-12 gap-x-6'>
          {COLUMNS.map(column => (
            <div
              key={column}
              className='flex h-32 items-end bg-card p-1 text-sm tabular-nums text-muted-foreground'
            >
              {column}
            </div>
          ))}
        </div>
      </FoundationSection>
      <FoundationSection
        title='Spans'
        about='Content takes whole columns. Below md, blocks stack to the full width.'
      >
        <div className='grid grid-cols-12 gap-x-6 gap-y-6'>
          <Span className='col-span-12' label='12' />
          <Span className='col-span-12 md:col-span-8' label='8' />
          <Span className='col-span-12 md:col-span-4' label='4' />
          <Span className='col-span-12 md:col-span-6' label='6' />
          <Span className='col-span-12 md:col-span-6' label='6' />
          <Span className='col-span-12 md:col-span-3' label='3' />
          <Span className='col-span-12 md:col-span-9' label='9' />
        </div>
      </FoundationSection>
      <FoundationSection
        title='Breakpoints'
        about='Four, from Tailwind: sm 640px, md 768px, lg 1024px, xl 1280px.'
      >
        <div className='grid grid-cols-12 gap-x-6 gap-y-6'>
          <Span
            className='col-span-12 sm:col-span-6 lg:col-span-3'
            label='12, 6 from sm, 3 from lg'
          />
          <Span
            className='col-span-12 sm:col-span-6 lg:col-span-3'
            label='12, 6 from sm, 3 from lg'
          />
          <Span
            className='col-span-12 sm:col-span-6 lg:col-span-3'
            label='12, 6 from sm, 3 from lg'
          />
          <Span
            className='col-span-12 sm:col-span-6 lg:col-span-3'
            label='12, 6 from sm, 3 from lg'
          />
        </div>
      </FoundationSection>
    </FoundationPage>
  ),
};
