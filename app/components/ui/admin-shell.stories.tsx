import { AdminShell, adminNavFor } from './admin-shell';
import { PageHeader } from './page-header';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof AdminShell> = {
  title: 'Layout/AdminShell',
  component: AdminShell,
  parameters: { remix: { path: '/admin/members/merge' } },
  args: { groups: adminNavFor(['admin', 'podcast']) },
  render: args => (
    <AdminShell {...args}>
      <PageHeader
        title='Merge duplicates'
        description='Fold one member into another when Sleeper made two of them.'
      />
    </AdminShell>
  ),
};
export default meta;

type Story = StoryObj<typeof AdminShell>;

export const Admin: Story = {};

/** A podcast editor sees the admin home and Podcasts only. */
export const PodcastEditor: Story = {
  name: 'Podcast editor',
  args: { groups: adminNavFor(['podcast']) },
  parameters: { remix: { path: '/admin/podcasts' } },
};

export const Phone: Story = {
  globals: { viewport: { value: 'mobile2' } },
};
