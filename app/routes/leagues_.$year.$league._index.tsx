import { useLeague } from './leagues_.$year.$league';
import LeagueTable from '~/components/layout/standings/LeagueTable';
import { Section } from '~/components/ui/section';

export default function LeagueStandings() {
  const league = useLeague();
  return (
    <Section title='Standings'>
      <LeagueTable league={league} />
    </Section>
  );
}
