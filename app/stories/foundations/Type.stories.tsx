import {
  FoundationPage,
  FoundationSection,
  Name,
  TokenRow,
  TokenTable,
} from './parts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  GRID_UNIT,
  TYPE_BASE,
  TYPE_RATIO,
  TYPE_STEPS,
  type TypeStep,
  typeScale,
} from '~/styles/tokens/scale';

const meta: Meta = {
  title: 'Foundations/Type',
};

export default meta;
type Story = StoryObj;

/** Written out so Tailwind sees each class. */
const STEP_CLASS: Record<TypeStep, string> = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
  '3xl': 'text-3xl',
  '4xl': 'text-4xl',
};

const px = (value: number) => `${Number(value.toFixed(2))}px`;

const WEIGHTS = [
  { className: 'font-normal', name: 'Regular', use: 'Body text and tables.' },
  { className: 'font-semibold', name: 'Semibold', use: 'Names, labels.' },
  { className: 'font-bold', name: 'Bold', use: 'Section headings.' },
  {
    className: 'font-extrabold',
    name: 'Extra bold',
    use: 'The largest steps.',
  },
  { className: 'font-black', name: 'Black', use: 'Page titles.' },
];

/** A few made-up rows, to show figures lining up on equal-width digits. */
const SCORES = [
  ['Harbor Lights', '5', '1', '812.40'],
  ['Quiet Corner', '5', '1', '788.90'],
  ['Orbit Seven', '4', '2', '801.30'],
  ['Paper Lantern', '4', '2', '760.10'],
];

export const Scale: Story = {
  render: () => (
    <FoundationPage
      title='Type'
      intro={`Archivo, self-hosted as one variable file that carries every weight to Black and every width from Narrow to Expanded. Seven steps on a ${TYPE_RATIO} ratio from a ${TYPE_BASE}px base. Every line height is a whole number of ${GRID_UNIT}px grid units.`}
    >
      <FoundationSection
        title='Scale'
        about='Base is body text and tables; the steps above it are headings. Nothing off the scale exists.'
      >
        <TokenTable columns={['Sample', 'Class', 'Size', 'Line height']}>
          {[...TYPE_STEPS].reverse().map(step => {
            const { size, leading } = typeScale[step];
            return (
              <TokenRow
                key={step}
                cells={[
                  <span
                    key='s'
                    className={`${STEP_CLASS[step]} ${
                      step === 'sm' || step === 'base'
                        ? ''
                        : 'font-extrabold tracking-tight'
                    }`}
                  >
                    Champions standings
                  </span>,
                  <Name key='c'>{STEP_CLASS[step]}</Name>,
                  px(size),
                  `${Math.round(size * leading)}px`,
                ]}
              />
            );
          })}
        </TokenTable>
      </FoundationSection>
      <FoundationSection title='Weights'>
        <TokenTable columns={['Sample', 'Class', 'Use']}>
          {WEIGHTS.map(weight => (
            <TokenRow
              key={weight.name}
              cells={[
                <span key='s' className={`text-xl ${weight.className}`}>
                  {weight.name}
                </span>,
                <Name key='c'>{weight.className}</Name>,
                <span key='u' className='text-muted-foreground'>
                  {weight.use}
                </span>,
              ]}
            />
          ))}
        </TokenTable>
      </FoundationSection>
      <FoundationSection
        title='Widths'
        about='Normal width everywhere, and font-narrow where columns are tight, such as the draft board. The narrow width is a depth token, so the Review/Depth playground can try it.'
      >
        <TokenTable columns={['Sample', 'Class', 'Use']}>
          <TokenRow
            cells={[
              <span key='s' className='text-xl font-semibold'>
                Amon-Ra St. Brown
              </span>,
              <Name key='c'>font-sans</Name>,
              <span key='u' className='text-muted-foreground'>
                Everything.
              </span>,
            ]}
          />
          <TokenRow
            cells={[
              <span key='s' className='font-narrow text-xl font-semibold'>
                Amon-Ra St. Brown
              </span>,
              <Name key='c'>font-narrow</Name>,
              <span key='u' className='text-muted-foreground'>
                Dense views: the draft board.
              </span>,
            ]}
          />
        </TokenTable>
      </FoundationSection>
      <FoundationSection
        title='Figures'
        about='Numbers in tables use equal-width digits (tabular-nums) and sit right-aligned, so columns line up.'
      >
        <table className='text-left tabular-nums'>
          <thead>
            <tr className='text-sm text-muted-foreground'>
              <th className='pb-2 pr-8 font-normal'>Manager</th>
              <th className='pb-2 pr-8 text-right font-normal'>Won</th>
              <th className='pb-2 pr-8 text-right font-normal'>Lost</th>
              <th className='pb-2 text-right font-normal'>Points for</th>
            </tr>
          </thead>
          <tbody>
            {SCORES.map(([name, ...figures]) => (
              <tr key={name} className='border-t border-border'>
                <td className='py-2 pr-8 font-semibold'>{name}</td>
                {figures.map((figure, i) => (
                  <td
                    key={i}
                    className={`py-2 text-right ${
                      i < figures.length - 1 ? 'pr-8' : ''
                    }`}
                  >
                    {figure}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </FoundationSection>
    </FoundationPage>
  ),
};
