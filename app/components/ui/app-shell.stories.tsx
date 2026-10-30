import { AppShell } from './app-shell';
import { PageHeader } from './page-header';
import { Section } from './section';
import { SubNav } from './sub-nav';
import type { Meta, StoryObj } from '@storybook/react-vite';

const MEMBER = {
  discordName: 'Panda',
  discordId: 'legacy:panda',
  discordAvatar: '',
};

const meta: Meta<typeof AppShell> = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen', remix: { path: '/leagues/standings' } },
  args: { user: MEMBER, isEditor: false, canViewProfiles: true },
  render: args => (
    <AppShell {...args}>
      <PageHeader
        title='Standings'
        description='Every league this season, by record, then points for.'
        nav={
          <SubNav
            label='Leagues'
            items={[
              { label: 'Overview', to: '/leagues', end: true },
              { label: 'Standings', to: '/leagues/standings' },
              { label: 'Leaderboard', to: '/leagues/leaderboard' },
              { label: 'Cup', to: '/leagues/cup' },
              { label: 'Records', to: '/leagues/records' },
            ]}
          />
        }
      />
      <Section title='Admiral'>
        <p className='text-muted-foreground'>The league table goes here.</p>
      </Section>
    </AppShell>
  ),
};
export default meta;

type Story = StoryObj<typeof AppShell>;

export const SignedIn: Story = { name: 'Signed in' };

export const SignedOut: Story = { name: 'Signed out', args: { user: null } };

export const Phone: Story = {
  globals: { viewport: { value: 'mobile2' } },
};
