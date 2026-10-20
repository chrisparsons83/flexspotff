import { Section } from '~/components/ui/section';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'Rules' };

export default function QBStreamingRules() {
  return (
    <Section title='Rules'>
      <div className='prose'>
        <p>
          Each week, pick two low-rostered quarterbacks to stream: one from the
          standard list and one from the deep list. Your picks score on the
          system below.
        </p>
        <ul>
          <li>0.04 points per passing yard</li>
          <li>0.1 points per rushing or receiving yard</li>
          <li>4 points per passing TD</li>
          <li>6 points per rushing or receiving TD</li>
          <li>−2 points per interception or fumble</li>
          <li>2 points per 2-point conversion</li>
        </ul>
        <p>
          Your 12 best weekly scores make your season. The highest total at the
          end of the season wins.
        </p>
      </div>
    </Section>
  );
}
