import { Section } from '~/components/ui/section';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Rules' };

export default function SpreadPoolRules() {
  return (
    <Section title='Rules'>
      <div className='prose'>
        <p>
          Start the season with 1000 points. Each week, you must make at least
          one bet, but may make as many as you want that fit within your budget.
          Max bet on any one game is 50 points. Payouts are paid out at even
          points for being correct. Bets lock as games start. You can’t use
          winnings from the current week to bet on teams in the same week.
          Missing a week will result in forfeiting 20 points. Highest total at
          the end of NFL regular season wins.
        </p>
      </div>
    </Section>
  );
}
