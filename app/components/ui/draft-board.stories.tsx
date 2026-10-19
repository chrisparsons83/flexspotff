import { DraftBoard, DraftBoardCell, DraftBoardHeader } from './draft-board';
import { positionTint } from './fills';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = { title: 'Data/DraftBoard' };
export default meta;

type Story = StoryObj;

const TEAMS = ['Panda', 'Herbal', 'Bill', 'Deniska'];

const PICKS: Record<string, [string, string, string][]> = {
  Panda: [
    ['Bijan Robinson', 'RB', 'ATL'],
    ['Sam LaPorta', 'TE', 'DET'],
    ['Josh Allen', 'QB', 'BUF'],
  ],
  Herbal: [
    ['CeeDee Lamb', 'WR', 'DAL'],
    ['Saquon Barkley', 'RB', 'PHI'],
  ],
  Bill: [
    ['Ja’Marr Chase', 'WR', 'CIN'],
    ['Lamar Jackson', 'QB', 'BAL'],
    ['Ravens', 'DEF', 'BAL'],
  ],
  Deniska: [
    ['Breece Hall', 'RB', 'NYJ'],
    ['Justin Tucker', 'K', 'BAL'],
    ['Puka Nacua', 'WR', 'LAR'],
  ],
};

/**
 * Each cell wears its position's tint. A missing pick leaves a dashed
 * placeholder so the rows still line up.
 */
export const Default: Story = {
  render: () => (
    <DraftBoard
      columns={TEAMS}
      rounds={3}
      columnKey={team => team}
      renderHeader={team => (
        <DraftBoardHeader
          title={team}
          subtitle={`Slot ${TEAMS.indexOf(team) + 1}`}
        />
      )}
      renderCell={(team, round) => {
        const pick = PICKS[team][round - 1];
        if (!pick) return null;
        const [name, position, nflTeam] = pick;
        const slot = TEAMS.indexOf(team);
        const number =
          (round - 1) * TEAMS.length +
          (round % 2 === 1 ? slot + 1 : TEAMS.length - slot);
        return (
          <DraftBoardCell
            title={name}
            subtitle={`${position} ${nflTeam}`}
            corner={number}
            tone={positionTint(position)}
            highlighted={name === 'Josh Allen'}
          />
        );
      }}
    />
  ),
};
