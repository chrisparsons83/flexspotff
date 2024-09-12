import { LockClosedIcon } from '@heroicons/react/outline';
import clsx from 'clsx';
import { useState } from 'react';

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
    <div>
      <h3 className='flex gap-2'>
        {leagueName}
        {leagueLocked && <LockClosedIcon width={32} height={32} />}
      </h3>
      {teams.map((team, index) => (
        <div
          key={team.id}
          className={clsx(
            index % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800',
            'p-2',
          )}
        >
          <label className='block'>
            <input
              type='checkbox'
              name={leagueName}
              value={team.id}
              onChange={handleChangeCheck}
              disabled={
                leagueLocked ||
                (selected.length === 2 && !selected.includes(team.id))
              }
              className='disabled:opacity-25'
              defaultChecked={
                existingPicks ? existingPicks.includes(team.id) : false
              }
            />{' '}
            {team.user?.discordName || 'N/A'}
          </label>
        </div>
      ))}
    </div>
  );
}
