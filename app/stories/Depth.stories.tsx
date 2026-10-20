import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from '~/components/ui/app-shell';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  DraftBoard,
  DraftBoardCell,
  DraftBoardHeader,
} from '~/components/ui/draft-board';
import { positionTint } from '~/components/ui/fills';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
import { Table } from '~/components/ui/table';
import { WinLoss } from '~/components/ui/win-loss';
import {
  DEFAULT_DEPTH,
  type Depth,
  depthTokens,
  FLAT_DEPTH,
} from '~/styles/tokens/depth';
import { leagues, neutralSteps, type Theme } from '~/styles/tokens/palette';

/** The lightest neutral step: light mode counts its surfaces down from it. */
const TOP = neutralSteps.length - 1;

/**
 * Knobs the depth tokens do not have, because they change the palette:
 * how far a card sits above the ground, whether light cards are white on a
 * grey page rather than grey on a near-white one, and how much of its
 * colour a league's panel takes.
 */
type Surfaces = {
  /** Neutral steps from the ground to a card. The palette has 1. */
  cardStep: number;
  lightCards: 'grey' | 'white';
  /** Chroma of a league panel's tint. The palette has 0.014. */
  leagueTint: number;
};

type Args = Depth & Surfaces;

const surfaces = (
  theme: Theme,
  { cardStep, lightCards, leagueTint }: Surfaces,
) => {
  const white = theme === 'light' && lightCards === 'white';
  const cardL = white
    ? 1
    : neutralSteps[theme === 'dark' ? cardStep : TOP - cardStep].l;
  // Each league's tint, at the card's lightness as the palette makes them.
  const tints = Object.fromEntries(
    Object.entries(leagues).map(([name, { h }]) => [
      `league-${name}-tint`,
      `${cardL} ${leagueTint} ${h}`,
    ]),
  );
  return {
    ...(white
      ? { background: 'var(--neutral-19)', card: '1 0 0' }
      : {
          card: `var(--neutral-${
            theme === 'dark' ? cardStep : TOP - cardStep
          })`,
        }),
    ...tints,
  };
};

/**
 * The knobs as a style block. Each theme gets every token again, because
 * the depth tokens read the surfaces where they are declared. The light rule
 * comes last, so a light pane inside the dark page wins.
 */
const playgroundCss = (args: Args) => {
  const block = (theme: Theme) =>
    Object.entries({ ...depthTokens(theme, args), ...surfaces(theme, args) })
      .map(([name, value]) => `--${name}: ${value};`)
      .join(' ');
  return [
    `[data-depth] { ${block('light')} }`,
    `.dark [data-depth] { ${block('dark')} }`,
    `.light [data-depth] { ${block('light')} }`,
  ].join('\n');
};

const range = (min: number, max: number, step: number) => ({
  control: { type: 'range' as const, min, max, step },
});

const meta: Meta<Args> = {
  title: 'Review/Depth',
  parameters: { layout: 'fullscreen', remix: { path: '/leagues/standings' } },
  args: {
    ...DEFAULT_DEPTH,
    cardStep: 1,
    lightCards: 'grey',
    leagueTint: 0.014,
  },
  argTypes: {
    cardStep: { ...range(1, 5, 1), table: { category: 'Surfaces' } },
    lightCards: {
      control: 'inline-radio',
      options: ['grey', 'white'],
      table: { category: 'Surfaces' },
    },
    leagueTint: { ...range(0, 0.06, 0.002), table: { category: 'Surfaces' } },
    positionTint: { ...range(0.1, 0.5, 0.02), table: { category: 'Surfaces' } },
    chromeOnPage: { control: 'boolean', table: { category: 'Surfaces' } },
    radius: { ...range(0, 12, 1), table: { category: 'Surfaces' } },
    hairline: { ...range(0, 0.3, 0.01), table: { category: 'Cards' } },
    lift: { ...range(0, 0.2, 0.01), table: { category: 'Cards' } },
    shadow: { ...range(0, 1, 0.05), table: { category: 'Cards' } },
    headerBand: { control: 'boolean', table: { category: 'Cards' } },
    warmth: { ...range(0, 40, 1), table: { category: 'Cards' } },
    gradientButton: { control: 'boolean', table: { category: 'Controls' } },
    outlineSecondary: { control: 'boolean', table: { category: 'Controls' } },
    pressDrop: { ...range(0, 5, 1), table: { category: 'Controls' } },
    tabs: {
      control: 'inline-radio',
      options: ['underline', 'block'],
      table: { category: 'Controls' },
    },
    navBar: { ...range(1, 6, 1), table: { category: 'Controls' } },
    glow: { ...range(0, 1.5, 0.05), table: { category: 'Glow' } },
    glowShape: {
      control: 'inline-radio',
      options: ['radial', 'wash', 'beam'],
      table: { category: 'Background' },
    },
    glowTone: {
      control: 'inline-radio',
      options: ['orange', 'red', 'deep', 'green'],
      table: { category: 'Background' },
    },
    pageGlow: { ...range(0, 70, 1), table: { category: 'Background' } },
    pageGlowReach: {
      ...range(300, 1400, 20),
      table: { category: 'Background' },
    },
    texture: {
      control: 'inline-radio',
      options: ['none', 'hashes', 'field', 'dots', 'grid', 'lines', 'diagonal'],
      table: { category: 'Background' },
    },
    textureStrength: {
      ...range(0, 0.3, 0.01),
      table: { category: 'Background' },
    },
    textureReach: {
      ...range(200, 1400, 20),
      table: { category: 'Background' },
    },
    well: { ...range(0, 50, 1), table: { category: 'Tables' } },
    capitalLabels: { control: 'boolean', table: { category: 'Type' } },
    labelWidth: { ...range(62, 100, 0.5), table: { category: 'Type' } },
    titleWidth: { ...range(62, 125, 0.5), table: { category: 'Type' } },
    titleWeight: { ...range(500, 900, 50), table: { category: 'Type' } },
    narrowWidth: { ...range(62, 100, 0.5), table: { category: 'Type' } },
  },
  render: args => <Playground {...args} />,
};
export default meta;

type Story = StoryObj<Args>;

/** What the depth tokens ship with: close to Brackt. */
export const Proposed: Story = {};

/** The site before #220, near enough, for comparison. */
export const Flat: Story = {
  args: { ...FLAT_DEPTH, cardStep: 2, leagueTint: 0.04 },
};

/** Brackt's shape with more of our own warmth: bands, a bar, a glow. */
export const Warmer: Story = {
  args: {
    headerBand: true,
    warmth: 18,
    navBar: 3,
    lift: 0.06,
    shadow: 0.3,
    pageGlow: 20,
    pageGlowReach: 900,
    cardStep: 2,
  },
};

const MEMBER = {
  discordName: 'Panda',
  discordId: 'legacy:panda',
  discordAvatar: '',
};

const STANDINGS: [string, number, number, number][] = [
  ['Panda', 9, 2, 1412.6],
  ['Lucky', 8, 3, 1388.1],
  ['Gridiron Gus', 7, 4, 1355.4],
  ['Kat', 6, 5, 1301.8],
  ['Sam the Man', 4, 7, 1219.0],
];

const LEAGUES = [
  ['admiral', 'Panda', '9 and 2'],
  ['champions', 'Herbal', '8 and 3'],
  ['dragon', 'Bill', '8 and 3'],
  ['galaxy', 'Lucky', '7 and 4'],
  ['monarch', 'Kat', '9 and 2'],
] as const;

const TEAMS = ['Panda', 'Herbal', 'Bill', 'Deniska', 'Kat', 'Lucky'];

const PICKS: [string, string, string][] = [
  ['Bijan Robinson', 'RB', 'ATL'],
  ['CeeDee Lamb', 'WR', 'DAL'],
  ['Ja’Marr Chase', 'WR', 'CIN'],
  ['Breece Hall', 'RB', 'NYJ'],
  ['Sam LaPorta', 'TE', 'DET'],
  ['Josh Allen', 'QB', 'BUF'],
  ['Saquon Barkley', 'RB', 'PHI'],
  ['Lamar Jackson', 'QB', 'BAL'],
  ['Puka Nacua', 'WR', 'LAR'],
  ['Ravens', 'DEF', 'BAL'],
  ['Travis Kelce', 'TE', 'KC'],
  ['Amon-Ra St. Brown', 'WR', 'DET'],
];

function Playground(args: Args) {
  return (
    <div data-depth>
      <style>{playgroundCss(args)}</style>
      <AppShell user={MEMBER} isEditor={false} canViewProfiles>
        <PageHeader
          title='Standings'
          description='Every league this season, by record, then points for.'
          actions={
            <>
              <Button variant='secondary'>Export</Button>
              <Button>Set lineup</Button>
            </>
          }
          nav={
            <SubNav
              label='Leagues'
              items={[
                { label: 'Overview', to: '/leagues', end: true },
                { label: 'Standings', to: '/leagues/standings' },
                { label: 'Leaderboard', to: '/leagues/leaderboard' },
                { label: 'Cup', to: '/leagues/cup' },
              ]}
            />
          }
        />

        <div className='grid gap-6 lg:grid-cols-3'>
          <Card className='lg:col-span-2'>
            <CardHeader>
              <CardTitle>Admiral</CardTitle>
            </CardHeader>
            <Table
              headers={['Team', 'Record', 'Points for']}
              numericColumns={[1, 2]}
              caption='Admiral standings'
            >
              {STANDINGS.map(([name, wins, losses, points]) => (
                <tr key={name}>
                  <td className='font-semibold'>{name}</td>
                  <td className='text-right'>
                    <WinLoss wins={wins} losses={losses} />
                  </td>
                  <td className='text-right'>{points.toFixed(1)}</td>
                </tr>
              ))}
            </Table>
          </Card>

          <div className='grid content-start gap-6'>
            <Card league='league-galaxy'>
              <CardHeader>
                <CardTitle>Galaxy</CardTitle>
              </CardHeader>
              <CardContent>
                Lucky leads by a game with three to play.
              </CardContent>
            </Card>
            {/* A live game asks for the glow by name. */}
            <Card glow>
              <CardHeader>
                <CardTitle>Live now</CardTitle>
              </CardHeader>
              <CardContent className='tabular-nums'>
                Panda 98.4, Kat 91.2, fourth quarter.
              </CardContent>
            </Card>
          </div>
        </div>

        <h2 className='mb-4 mt-12 text-2xl font-bold'>Leagues</h2>
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-5'>
          {LEAGUES.map(([league, leader, record]) => (
            <Card key={league} league={`league-${league}`}>
              <CardHeader>
                <CardTitle className='capitalize'>{league}</CardTitle>
              </CardHeader>
              <CardContent>
                {leader} leads at {record}.
              </CardContent>
            </Card>
          ))}
        </div>

        <h2 className='mb-4 mt-12 text-2xl font-bold'>Draft board</h2>
        <DraftBoard
          columns={TEAMS}
          rounds={2}
          columnKey={team => team}
          renderHeader={team => (
            <DraftBoardHeader
              title={team}
              subtitle={`Slot ${TEAMS.indexOf(team) + 1}`}
            />
          )}
          renderCell={(team, round) => {
            const slot = TEAMS.indexOf(team);
            const index =
              (round - 1) * TEAMS.length +
              (round % 2 === 1 ? slot : TEAMS.length - 1 - slot);
            const [name, position, nflTeam] = PICKS[index];
            return (
              <DraftBoardCell
                title={name}
                subtitle={`${position} ${nflTeam}`}
                corner={index + 1}
                tone={positionTint(position)}
              />
            );
          }}
        />
      </AppShell>
    </div>
  );
}
