import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';

export default function DfsSurvivorRules() {
  return (
    <Section title='Rules'>
      <div className='prose'>
        <p>
          Each week, you will select a lineup consisting of 2 QBs, 2 RBs, 2 WRs,
          1 TE, 1 FLEX, 1 K, and 1 DST. At the end of the week, your lineup’s
          total points will be calculated and added to your overall score.
        </p>
        <p>
          You have until the start of a player’s game to add or remove them from
          your lineup. You cannot reuse any players you have already selected in
          previous weeks.
        </p>
        <p>
          Scoring will follow the same system as the Discord leagues. For more
          details, please refer to the{' '}
          <Link to='/leagues/rules'>league’s scoring rules</Link>.
        </p>
        <p>
          The player with the most points at the end of week 17 will be declared
          the winner. There are no penalties for missing a week or leaving a
          player slot empty.
        </p>
      </div>
    </Section>
  );
}
