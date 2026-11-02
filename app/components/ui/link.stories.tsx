import { ExternalLink, Link } from './link';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Link> = {
  title: 'Primitives/Link',
  component: Link,
};
export default meta;

type Story = StoryObj<typeof Link>;

export const Inline: Story = {
  render: () => (
    <p className='max-w-prose'>
      Picks lock at kickoff. The full scoring is on the{' '}
      <Link to='/games/spread-pool/rules'>rules page</Link>, and the league
      talks it through on{' '}
      <ExternalLink href='https://discord.gg/'>Discord</ExternalLink>.
    </p>
  ),
};

/** For links whose place already says they are links, like names in a table. */
export const Quiet: Story = {
  render: () => (
    <Link to='/u/panda' variant='quiet' className='font-semibold'>
      Panda
    </Link>
  ),
};
