import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Rules' };

export default function FSquaredRules() {
  return (
    <Section title='Rules'>
      <div className='prose'>
        <p>
          Before the leagues draft, pick two teams from each league. Teams are
          listed by draft order, so you are picking managers and draft slots,
          not rosters.
        </p>
        <p>
          You can change your picks for a league until its draft begins. If you
          enter after a league has drafted, you are given two of its teams at
          random.
        </p>
        <p>
          Your score is the regular-season points for of every team you picked,
          added together. Points are scored as in the{' '}
          <Link to='/leagues/rules'>league rules</Link>.
        </p>
        <p>
          The highest total at the end of the regular season wins. A tie is
          shared.
        </p>
      </div>
    </Section>
  );
}
