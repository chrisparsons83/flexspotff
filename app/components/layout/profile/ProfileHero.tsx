import Honours from './Honours';
import type { ReactNode } from 'react';
import MemberAvatar from '~/components/ui/MemberAvatar';
import { Link } from '~/components/ui/link';
import { StatList } from '~/components/ui/stat-list';
import type { ProfileSummary } from '~/models/profile/summary.server';

type Props = {
  summary: ProfileSummary;
  /** Rendered along the bottom edge, so the tabs read as part of the header. */
  tabs?: ReactNode;
};

export default function ProfileHero({ summary, tabs }: Props) {
  const { user, headline, badges } = summary;
  const showUsername =
    user.discordUsername && user.discordUsername !== user.discordName;

  return (
    <section className='not-prose bg-card text-card-foreground'>
      <div className='p-4 md:p-6'>
        <div className='flex flex-wrap items-center gap-4'>
          <MemberAvatar user={user} size={64} />
          <div>
            <h2 className='m-0 text-3xl font-extrabold tracking-tight'>
              {user.discordName}
            </h2>
            {/* Each fact on its own line rather than split by a dot. */}
            <div className='m-0 mt-1 grid text-muted-foreground'>
              {showUsername && <span>@{user.discordUsername}</span>}
              <span>Member since {user.memberSince}</span>
            </div>
          </div>
        </div>

        <div className='mt-6'>
          <StatList stats={headline} />
        </div>

        <Honours badges={badges} />

        {badges.length > 0 && (
          <p className='m-0 mt-4 text-sm'>
            <Link to='/badges'>What these mean</Link>
          </p>
        )}
      </div>

      {tabs}
    </section>
  );
}
