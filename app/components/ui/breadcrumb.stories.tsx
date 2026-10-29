import { Breadcrumb } from './breadcrumb';
import { PageHeader } from './page-header';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Breadcrumb> = {
  title: 'Layout/Breadcrumb',
  component: Breadcrumb,
  parameters: { remix: { path: '/games/qb-streaming/standings/2026/7' } },
  args: {
    items: [
      { label: 'Games', to: '/games' },
      { label: 'QB streaming', to: '/games/qb-streaming' },
      { label: '2026 standings', to: '/games/qb-streaming/standings/2026' },
      { label: 'Week 7', to: '/games/qb-streaming/standings/2026/7' },
    ],
  },
};
export default meta;

type Story = StoryObj<typeof Breadcrumb>;

/** A week of a game's standings, four levels down. */
export const Default: Story = {};

/** Above the page title, where the shell puts it. */
export const AbovePageHeader: Story = {
  name: 'Above the page header',
  render: args => (
    <>
      <Breadcrumb {...args} />
      <PageHeader title='Week 7' />
    </>
  ),
};

/** One level down: the section, then this page. */
export const Short: Story = {
  parameters: { remix: { path: '/games/qb-streaming' } },
  args: {
    items: [
      { label: 'Games', to: '/games' },
      { label: 'QB streaming', to: '/games/qb-streaming' },
    ],
  },
};

/** On a phone only the level above shows, as the way back up. */
export const Phone: Story = {
  globals: { viewport: { value: 'mobile2' }, theme: 'dark' },
  render: args => (
    <>
      <Breadcrumb {...args} />
      <PageHeader title='Week 7' />
    </>
  ),
};
