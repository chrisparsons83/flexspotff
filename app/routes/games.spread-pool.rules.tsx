import { Section } from '~/components/ui/section';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Rules' };

export default function SpreadPoolRules() {
  return (
    <Section title='Rules'>
      <div className='prose'>
        <p>
          Start the season with 1000 points. Each week, bet on NFL games against
          the spread. You must make at least one bet a week, and you can make as
          many as fit in your budget, up to 50 points on any one game.
        </p>
        <p>
          A correct bet pays out at even money. Bets lock as each game starts,
          and you cannot bet winnings from a week on games in the same week.
        </p>
        <p>
          Missing a week costs 20 points. The highest total at the end of the
          NFL regular season wins.
        </p>
      </div>
    </Section>
  );
}
