import { Section } from '~/components/ui/section';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Rules' };

export default function LocksChallengeRules() {
  return (
    <Section title='Rules'>
      <div className='prose'>
        <p>
          Each week, pick the winners of as many games as you like. If none of
          your teams lose, you score a point for each team that won. If any of
          your teams lose, you score nothing for the week.
        </p>
        <p>
          A tie does not count as a loss, but it does not score a point either.
        </p>
        <p>
          The most points at the end of week 17 wins. There is no penalty for
          skipping a week, other than the points you could have scored.
        </p>
      </div>
    </Section>
  );
}
