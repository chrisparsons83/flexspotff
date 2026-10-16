import { FoundationPage, FoundationSection } from './foundations/parts';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Review/Patterns we do not use',
  // It quotes the phrases it bans, so the copy check would flag it.
  parameters: { patterns: { disable: true } },
  // One page is enough; the list reads the same in either theme.
  globals: { theme: 'dark' },
};
export default meta;

type Story = StoryObj;

type Rule = { rule: string; checked: 'script' | 'person' };

/**
 * The list from #189, and who checks each line. `npm run check-storybook`
 * runs in CI over every story, with axe for accessibility; the rest needs a
 * person looking at the story in both themes.
 */
const RULES: { group: string; rules: Rule[] }[] = [
  {
    group: 'Separators and labels',
    rules: [
      {
        rule: 'No middle dot, bullet or pipe as an inline separator between bits of metadata.',
        checked: 'script',
      },
      {
        rule: 'No rounded pills or chips, and no tag dropped next to a name in a table row. Categories are a column, grid position or a colour step.',
        checked: 'person',
      },
      {
        rule: 'No small uppercase eyebrow labels with wide letter-spacing above headings.',
        checked: 'script',
      },
      { rule: 'No coloured status dots in front of text.', checked: 'person' },
    ],
  },
  {
    group: 'Emoji and icons',
    rules: [
      { rule: 'No emoji anywhere in the UI.', checked: 'script' },
      {
        rule: 'No sparkle icons, and no icon beside every label or heading. An icon only replaces a word: close, menu, sort direction.',
        checked: 'person',
      },
      {
        rule: 'No icons in tinted rounded squares or circles.',
        checked: 'person',
      },
      {
        rule: 'No info-circle tooltips. What needs explaining is written on the page once.',
        checked: 'person',
      },
    ],
  },
  {
    group: 'Surfaces and shape',
    rules: [
      { rule: 'No rounded corners.', checked: 'script' },
      {
        rule: 'No cards nested in cards, and no bordered card around every block. A Card inside a Card logs an error.',
        checked: 'person',
      },
      {
        rule: 'No coloured left-border accent strips on cards or callouts.',
        checked: 'script',
      },
      {
        rule: 'No gradients but the page glow: no gradient text or borders, no glows, no glassmorphism or backdrop blur.',
        checked: 'script',
      },
      {
        rule: 'No shadows but on overlays and on buttons, which sit on a solid drop in a darker shade of themselves.',
        checked: 'script',
      },
    ],
  },
  {
    group: 'Layout',
    rules: [
      {
        rule: 'No three-up icon, title and blurb feature grids.',
        checked: 'person',
      },
      {
        rule: 'No walls of stat tiles as the default way to show data. Tables and charts on the grid come first.',
        checked: 'person',
      },
      {
        rule: 'No hover lift, scale or bounce, and nothing animating in on load. Motion is for state changes and stays short.',
        checked: 'person',
      },
      {
        rule: 'No unmodified shadcn defaults. Everything takes the tokens.',
        checked: 'person',
      },
    ],
  },
  {
    group: 'Copy',
    rules: [
      {
        rule: 'No em dashes, no exclamation marks, no "Oops", "Welcome back", "Let’s" or "Nothing to see here".',
        checked: 'script',
      },
      {
        rule: 'Sentence case everywhere. Labels are plain nouns.',
        checked: 'person',
      },
    ],
  },
];

export const Checklist: Story = {
  render: () => (
    <FoundationPage
      title='Patterns we do not use'
      intro='Every component is reviewed against this list from #189 in both themes. Lines marked Script are checked on every story in CI by npm run check-storybook, along with accessibility; the rest need a person.'
    >
      {RULES.map(({ group, rules }) => (
        <FoundationSection key={group} title={group}>
          <table className='w-full text-left'>
            <thead>
              <tr className='text-sm text-muted-foreground'>
                <th className='pb-2 pr-6 font-normal'>Rule</th>
                <th className='w-32 pb-2 font-normal'>Checked by</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(({ rule, checked }) => (
                <tr key={rule} className='border-t border-border align-top'>
                  <td className='max-w-prose py-3 pr-6'>{rule}</td>
                  <td className='py-3'>
                    {checked === 'script' ? 'Script' : 'Person'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </FoundationSection>
      ))}
    </FoundationPage>
  ),
};
