import { LockClosedIcon } from '@radix-ui/react-icons';
import { useState } from 'react';
import MemberName from '~/components/ui/MemberName';
import { LeagueMark } from '~/components/ui/swatch';
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
    <fieldset className='bg-card'>
      <legend className='sr-only'>{leagueName}</legend>
      <div className='flex items-center justify-between gap-2 bg-secondary px-5 py-3 font-bold text-secondary-foreground'>
        <LeagueMark name={leagueName} />
        {leagueLocked && (
          <span className='inline-flex items-center gap-1 text-sm font-normal text-muted-foreground'>
            <LockClosedIcon aria-hidden />
            Drafted
          </span>
        )}
      </div>
      <ul className='divide-y divide-border'>
        {teams.map(team => (
          <li key={team.id}>
            <label className='flex items-center gap-3 px-5 py-2'>
              <input
                type='checkbox'
                name={leagueName}
                value={team.id}
                onChange={handleChangeCheck}
                disabled={
                  leagueLocked ||
                  (selected.length === 2 && !selected.includes(team.id))
                }
                className='size-4 accent-[oklch(var(--primary))] disabled:opacity-50'
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
  );
}
