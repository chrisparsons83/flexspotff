import ContestEmptyState from './ContestEmptyState';
import ProfileTable from './ProfileTable';
import StatTile from './StatTile';
import type { ContestProfile } from '~/models/profile/sideGames.server';

type Props = {
  profile: ContestProfile;
  memberName: string;
  /** Reads after "hasn't played", e.g. "the Spread Pool". */
  contestLabel: string;
  /** Column header for the middle column of the season table. */
  seasonColumnLabel?: string;
};

/**
 * The shape every side game tab shares: headline numbers, then a season table.
 *
 * The games score nothing like each other, so each profile module decides what
 * its numbers mean and this only decides how they look - which is what keeps
 * nine tabs feeling like one page.
 */
export default function ContestTab({
  profile,
  memberName,
  contestLabel,
  seasonColumnLabel = 'Detail',
}: Props) {
  if (!profile.hasPlayed) {
    return <ContestEmptyState contest={contestLabel} memberName={memberName} />;
  }

  return (
    <div className='space-y-6'>
      <div className='not-prose grid grid-cols-2 gap-2 sm:grid-cols-4'>
        <StatTile label='Seasons' value={profile.seasonsPlayed.toString()} />
        {profile.headline.map(stat => (
          <StatTile key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <section>
        <h3>By Season</h3>
        <ProfileTable
          headers={['Year', seasonColumnLabel, 'Total', '']}
          numericColumns={[2]}
        >
          {profile.seasons.map(season => (
            <tr key={season.year} className='border-b border-gray-800'>
              <td className='px-2 py-2'>{season.year}</td>
              <td className='px-2 py-2 text-gray-300'>{season.label}</td>
              <td className='px-2 py-2 text-right font-medium'>
                {season.value}
              </td>
              <td className='px-2 py-2 text-xs text-gray-400'>
                {season.detail ?? ''}
              </td>
            </tr>
          ))}
        </ProfileTable>
      </section>
    </div>
  );
}
