import {
  FoundationPage,
  FoundationSection,
  Name,
  TokenRow,
  TokenTable,
} from './parts';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Logo, MARK_PATH } from '~/components/brand/Logo';

const meta: Meta = {
  title: 'Foundations/Logo',
};

export default meta;
type Story = StoryObj;

/** The mark alone, in the accent, at a pixel size. */
function Mark({ size }: { size: number }) {
  return (
    <svg
      viewBox='0 0 32 32'
      width={size}
      height={size}
      role='img'
      aria-label='Flex Spot'
    >
      <path className='fill-primary' fillRule='evenodd' d={MARK_PATH} />
    </svg>
  );
}

/** Served from public/logo by Storybook's static files, as on the site. */
const FILES = [
  { file: 'flexspot-lockup-dark.svg', use: 'Lockup for dark grounds.' },
  { file: 'flexspot-lockup-light.svg', use: 'Lockup for light grounds.' },
  { file: 'flexspot-lockup-white.svg', use: 'Lockup in one colour, white.' },
  { file: 'flexspot-lockup-black.svg', use: 'Lockup in one colour, black.' },
  { file: 'flexspot-mark.svg', use: 'The mark in the accent.' },
  { file: 'flexspot-mark-white.svg', use: 'The mark in one colour, white.' },
  { file: 'flexspot-mark-black.svg', use: 'The mark in one colour, black.' },
  { file: 'flexspot-icon-square.svg', use: 'White mark on an accent square.' },
  { file: 'flexspot-icon-circle.svg', use: 'White mark on an accent circle.' },
];

/** A ground that suits the file, so white and black artwork both show. */
const fileGround = (file: string) =>
  file.includes('white') || file.includes('dark')
    ? 'bg-neutral-0'
    : file.includes('black') || file.includes('light')
    ? 'bg-neutral-20'
    : 'bg-card';

export const Usage: Story = {
  render: () => (
    <FoundationPage
      title='Logo'
      intro='A football speech bubble with cut-out laces, and the name. The mark is always the logo orange, which is the accent fill; the name takes the text colour, so one component serves both themes.'
    >
      <FoundationSection
        title='Lockup'
        about='The Logo component. Size it with a height class; the nav uses h-7 (28px) and links it home.'
      >
        <div className='grid grid-cols-12 gap-x-6 gap-y-6'>
          <div className='col-span-12 flex h-40 items-center justify-center bg-background md:col-span-6'>
            <Logo className='h-7 w-auto' />
          </div>
          <div className='col-span-12 flex h-40 items-center justify-center bg-card md:col-span-6'>
            <Logo className='h-12 w-auto' />
          </div>
        </div>
        <p className='mt-3 text-sm text-muted-foreground'>
          On the ground at 28px, and on a card at 48px.
        </p>
      </FoundationSection>
      <FoundationSection
        title='Mark'
        about='The mark sits on a pixel grid, so it stays sharp at favicon sizes.'
      >
        <TokenTable columns={['Sample', 'Size', 'Use']}>
          {[
            { size: 16, use: 'favicon.ico' },
            { size: 32, use: 'favicon.svg' },
          ].map(({ size, use }) => (
            <TokenRow
              key={size}
              cells={[
                <Mark key='m' size={size} />,
                `${size}px`,
                <span key='u' className='text-muted-foreground'>
                  {use}
                </span>,
              ]}
            />
          ))}
        </TokenTable>
      </FoundationSection>
      <FoundationSection
        title='Files'
        about='In public/logo. Replace the files rather than editing the artwork in code; Logo.test.ts keeps the component in step with the dark lockup.'
      >
        <TokenTable columns={['Sample', 'File', 'Use']}>
          {FILES.map(({ file, use }) => (
            <TokenRow
              key={file}
              cells={[
                <span
                  key='s'
                  className={`flex h-16 w-40 items-center justify-center ${fileGround(
                    file,
                  )}`}
                >
                  <img src={`logo/${file}`} alt='' className='h-8 w-auto' />
                </span>,
                <Name key='f'>{file}</Name>,
                <span key='u' className='text-muted-foreground'>
                  {use}
                </span>,
              ]}
            />
          ))}
        </TokenTable>
      </FoundationSection>
    </FoundationPage>
  ),
};
