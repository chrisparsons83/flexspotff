import BadgeRow from './BadgeRow';
import StatTile from './StatTile';
import { Link } from '@remix-run/react';
import type { ReactNode } from 'react';
import MemberAvatar from '~/components/ui/MemberAvatar';
import type { ProfileSummary } from '~/models/profile/summary.server';

type Props = {
  summary: ProfileSummary;
  /** Rendered as a strip along the bottom edge, so the tabs read as part of the header. */
  tabs?: ReactNode;
};

export default function ProfileHero({ summary, tabs }: Props) {
  const { user, headline, badges } = summary;
  const showUsername =
    user.discordUsername && user.discordUsername !== user.discordName;

  return (
    <section className='not-prose overflow-hidden rounded-lg border border-slate-600/40 bg-slate-800/40'>
      <div className='p-4 md:p-6'>
        <div className='flex flex-wrap items-center gap-4'>
          <MemberAvatar user={user} size={64} />
          <div>
            <h2 className='m-0 text-2xl font-bold text-white'>
              {user.discordName}
            </h2>
            {/* A rule between the two rather than a dot, which read as
                punctuation. */}
            <p className='m-0 mt-1 flex flex-wrap items-center gap-x-3 text-sm text-slate-400'>
              {showUsername && (
                <span className='border-r border-slate-600 pr-3'>
                  @{user.discordUsername}
                </span>
              )}
              <span>Member since {user.memberSince}</span>
            </p>
          </div>
        </div>

        <div className='mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6'>
          {headline.map(stat => (
            <StatTile key={stat.label} label={stat.label} value={stat.value} />
          ))}
        </div>

        <BadgeRow badges={badges} />

        {badges.length > 0 && (
          <p className='m-0 mt-3 text-xs text-slate-400'>
            <Link to='/badges'>What do these mean?</Link>
          </p>
        )}
      </div>

      {tabs}
    </section>
  );
}
