import { Section } from '~/components/ui/section';

export default function QBStreamingRules() {
  return (
    <Section title='Rules'>
      <div className='prose'>
        <p>
          Each week, pick two low-rostered QBs to stream from the available
          lists given. Earn points based on the following point system:
        </p>
        <ul>
          <li>0.04 per passing yard</li>
          <li>0.1 per rushing/receiving yard</li>
          <li>4 points per passing TD</li>
          <li>6 points per rushing/receiving TD</li>
          <li>−2 per interception/fumble</li>
          <li>2 per 2-point conversion</li>
        </ul>
        <p>
          Highest total from your best 12 weekly scores at the end of the season
          wins.
        </p>
      </div>
    </Section>
  );
}
