import BadgeRow from './BadgeRow';
import StatTile from './StatTile';
import clsx from 'clsx';
import type { ProfileSummary } from '~/models/profile/summary.server';
import { RANK_COLORS, isLeagueName } from '~/utils/constants';

type Props = {
  summary: ProfileSummary;
};

export default function ProfileHero({ summary }: Props) {
  const { user, currentTeam, headline, badges } = summary;
  const avatar = user.discordAvatar
    ? `https://cdn.discordapp.com/${user.discordAvatar}`
    : null;
  const leagueName = currentTeam?.leagueName.toLocaleLowerCase() ?? '';

  return (
    <section className='not-prose rounded-lg bg-gray-800/50 p-4 md:p-6'>
      <div className='flex flex-wrap items-center gap-4'>
        {avatar ? (
          <img
            src={avatar}
            alt=''
            className='h-16 w-16 rounded-full bg-gray-700'
          />
        ) : (
          <div
            aria-hidden='true'
            className='h-16 w-16 rounded-full bg-gray-700'
          />
        )}
        <div>
          <h2 className='m-0 text-2xl font-bold text-white'>
            {user.discordName}
          </h2>
          <p className='m-0 mt-1 text-sm text-gray-400'>
            Member since {user.memberSince.getFullYear()}
            {currentTeam && (
              <>
                {' · '}
                <span
                  className={clsx(
                    'rounded px-2 py-0.5 font-medium',
                    isLeagueName(leagueName)
                      ? RANK_COLORS[leagueName]
                      : 'bg-gray-700 text-gray-100',
                  )}
                >
                  {currentTeam.leagueName}
                </span>{' '}
                {currentTeam.year}
              </>
            )}
          </p>
        </div>
      </div>

      <div className='mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5'>
        {headline.map(stat => (
          <StatTile key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <BadgeRow badges={badges} />
    </section>
  );
}
