import { LockClosedIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import MemberName from '~/components/ui/MemberName';
import { Card, CardHeader, CardTitle } from '~/components/ui/card';
import { leagueFill } from '~/components/ui/fills';
import { Checkbox } from '~/components/ui/input';
import type { League } from '~/models/league.server';
import type { Team, getTeamsInSeason } from '~/models/team.server';

type Props = {
  leagueName: string;
  teams: Awaited<ReturnType<typeof getTeamsInSeason>>;
  existingPicks: Team['id'][] | null;
  isLeagueValid: (leagueName: League['id'], isValid: boolean) => void;
};

export default function FSquaredEntryFormSection({
  leagueName,
  teams,
  existingPicks,
  isLeagueValid,
}: Props) {
  const [selected, setSelected] = useState(existingPicks || []);

  const draftDateTime = teams[0].league.draftDateTime;
  const now = new Date();
  const leagueLocked = draftDateTime && draftDateTime < now;

  const handleChangeCheck = (event: React.ChangeEvent<HTMLInputElement>) => {
    const change = event.target.checked ? 1 : -1;
    const total = selected.length + change;
    const isLeagueFull = total === 2 || Boolean(leagueLocked);
    if (event.target.checked) {
      setSelected(prevState => [...prevState, event.target.value]);
    } else {
      setSelected(prevState =>
        prevState.filter(team => team !== event.target.value),
      );
    }
    isLeagueValid(leagueName, isLeagueFull);
  };

  return (
    // The league's own colours, as its card has on the home page.
    <Card league={leagueFill(leagueName) ?? undefined}>
      <CardHeader>
        <CardTitle>{leagueName}</CardTitle>
        {leagueLocked && (
          <span className='inline-flex items-center gap-1 text-sm'>
            <LockClosedIcon aria-hidden />
            Drafted
          </span>
        )}
      </CardHeader>
      <fieldset>
        <legend className='sr-only'>{leagueName}</legend>
        <ul className='divide-y divide-border'>
          {teams.map(team => (
            <li key={team.id}>
              <label className='flex items-center gap-3 px-5 py-2'>
                <Checkbox
                  name={leagueName}
                  value={team.id}
                  onChange={handleChangeCheck}
                  disabled={
                    leagueLocked ||
                    (selected.length === 2 && !selected.includes(team.id))
                  }
                  defaultChecked={
                    existingPicks ? existingPicks.includes(team.id) : false
                  }
                />
                {team.user ? <MemberName user={team.user} /> : 'Unclaimed team'}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
    </Card>
  );
}
