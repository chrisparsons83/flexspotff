import { LeagueMark, PositionMark, Swatch } from './swatch';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Swatch> = {
  title: 'Primitives/Swatch',
  component: Swatch,
};
export default meta;

type Story = StoryObj<typeof Swatch>;

/** In place of a coloured chip: a square of the colour, the name in neutral type. */
export const Leagues: Story = {
  render: () => (
    <ul className='grid gap-2'>
      {['Admiral', 'Champions', 'Dragon', 'Galaxy', 'Monarch', 'Omni'].map(
        name => (
          <li key={name}>
            <LeagueMark name={name} />
          </li>
        ),
      )}
    </ul>
  ),
};

export const Positions: Story = {
  render: () => (
    <table>
      <tbody>
        {[
          ['QB', 'Josh Allen'],
          ['RB', 'Bijan Robinson'],
          ['WR', 'CeeDee Lamb'],
          ['TE', 'Sam LaPorta'],
          ['DEF', 'Ravens'],
          ['K', 'Justin Tucker'],
        ].map(([position, player]) => (
          <tr key={player}>
            <td className='py-1 pr-4'>
              <PositionMark position={position} />
            </td>
            <td className='py-1'>{player}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};
