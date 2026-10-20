import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Rules' };

export default function DfsSurvivorRules() {
  return (
    <Section title='Rules'>
      <div className='prose'>
        <p>
          Each week, pick a lineup of 2 QBs, 2 RBs, 2 WRs, 1 TE, 1 flex, 1 K and
          1 DST. Its points at the end of the week are added to your season
          total.
        </p>
        <p>
          You can add or remove a player until their game starts. You cannot
          pick a player you have used in an earlier week.
        </p>
        <p>
          Points are scored as in the{' '}
          <Link to='/leagues/rules'>league rules</Link>.
        </p>
        <p>
          The most points at the end of week 17 wins. There is no penalty for
          missing a week or leaving a slot empty.
        </p>
      </div>
    </Section>
  );
}
