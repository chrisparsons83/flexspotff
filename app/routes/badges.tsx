import type { LoaderFunctionArgs } from '@remix-run/node';
import { Honour } from '~/components/layout/profile/Honours';
import ProfileSection from '~/components/layout/profile/ProfileSection';
import { PageHeader } from '~/components/ui/page-header';
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
      <PageHeader
        title='Badges'
        description='Every badge a profile can show, at its highest tier.'
      />

      <div className='grid gap-6'>
        <ProfileSection
          title='League'
          description='Earned in the redraft leagues and the Cup.'
        >
          <ul className='m-0 grid gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3'>
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
          </ul>
        </ProfileSection>

        <ProfileSection
          title='Side games'
          description='Every side game runs on the same scale, so winning the Spread Pool reads exactly like winning DFS Survivor.'
        >
          <ul className='m-0 grid gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3'>
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
          </ul>
        </ProfileSection>
      </div>
    </>
  );
}

function Entry({ badge, detail }: { badge: Badge; detail: string }) {
  return (
    <li className='grid grid-cols-[8rem_1fr] items-start gap-4'>
      {/* The real badge, at its top tier, so this page can never drift from
          what a profile actually renders. */}
      <Honour badge={badge} />
      <p className='m-0 text-sm text-muted-foreground'>{detail}</p>
    </li>
  );
}
