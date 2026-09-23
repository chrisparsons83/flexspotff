import type { LoaderFunctionArgs } from '@remix-run/node';
import { Ribbon } from '~/components/layout/profile/BadgeRow';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import {
  BADGE_DEFINITIONS,
  SIDE_GAME_KEYS,
  makeBadge,
  makeSideGameBadge,
  type Badge,
} from '~/models/profile/badges';
import { authenticator } from '~/services/auth.server';

/**
 * What every badge is, and what each of its stars costs.
 *
 * Profiles show a member's ribbons without saying what any of them mean or how
 * close they were to the next star. That belongs somewhere other than a
 * tooltip, so it lives here and every profile links to it.
 *
 * Members-only, to match the profiles it is reached from.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticator.isAuthenticated(request, { failureRedirect: '/login' });
  return null;
};

export const meta = () => [{ title: 'Badges - FlexSpot FF' }];

/**
 * Each badge at its top star, so the page shows what one looks like when it is
 * worth the most. A tallied badge has no top, so three stands in for "several".
 */
function atFullStrength(
  definition: (typeof BADGE_DEFINITIONS)[string],
): Badge | null {
  return makeBadge(
    definition,
    definition.scale === 'tally'
      ? 3
      : definition.scale[definition.scale.length - 1],
  );
}

/** What the stars cost. */
function scaleLine(definition: (typeof BADGE_DEFINITIONS)[string]): string {
  return definition.scale === 'tally'
    ? 'One star for each, with no cap.'
    : `A star at ${definition.scale.join(', then ')}.`;
}

export default function Badges() {
  const leagueDefinitions = Object.values(BADGE_DEFINITIONS);

  return (
    <>
      <h2>Badges</h2>

      <div className='mt-6 space-y-6'>
        <ProfileSection
          title='League'
          description='Earned in the redraft leagues and the Cup.'
        >
          <dl className='m-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {leagueDefinitions.map(definition => {
              const badge = atFullStrength(definition);
              if (!badge) return null;

              return (
                <Entry
                  key={definition.key}
                  badge={badge}
                  detail={`${definition.description}. ${scaleLine(definition)}`}
                />
              );
            })}
          </dl>
        </ProfileSection>

        <ProfileSection
          title='Side games'
          description='All six run on the same scale, so winning the Spread Pool reads exactly like winning DFS Survivor.'
        >
          <dl className='m-0 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {SIDE_GAME_KEYS.map(game => {
              const badge = makeSideGameBadge(game, 3);
              if (!badge) return null;

              return (
                <Entry
                  key={game}
                  badge={badge}
                  detail={`${badge.description}. One star for each, with no cap.`}
                />
              );
            })}
          </dl>
        </ProfileSection>
      </div>
    </>
  );
}

function Entry({ badge, detail }: { badge: Badge; detail: string }) {
  return (
    <div className='flex items-start gap-3'>
      {/* The real ribbon, at its top star, so this page can never drift from
          what a profile actually renders. */}
      <div className='not-prose h-[7.75rem] w-[5.5rem] shrink-0'>
        <Ribbon badge={badge} />
      </div>
      <div className='min-w-0'>
        <dt className='m-0 font-semibold text-white'>{badge.label}</dt>
        <dd className='m-0 mt-1 text-sm text-slate-400'>{detail}</dd>
      </div>
    </div>
  );
}
