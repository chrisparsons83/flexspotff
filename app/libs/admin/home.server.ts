import { prisma } from '~/db.server';
import { getUnmatchedTeams } from '~/libs/members/unmatched.server';
import { getCurrentNflWeek } from '~/models/nflgame.server';
import { getRegistrationCountByYear } from '~/models/registration.server';
import { getScheduledJobRuns } from '~/models/scheduledJobRun.server';
import { getCurrentSeason } from '~/models/season.server';

/** One thing for an admin to do this week, and the page that does it. */
export type AdminTask = {
  title: string;
  detail: string;
  href: string;
};

/**
 * What needs doing this week, as far as the data can tell: the week's games
 * not set up yet, waiver reports not posted, scheduled jobs that last failed,
 * Sleeper owners not matched to a member, and registration while it is open.
 */
export async function getAdminTasks(): Promise<{
  week: number | null;
  tasks: AdminTask[];
}> {
  const season = await getCurrentSeason();
  if (!season) {
    return {
      week: null,
      tasks: [
        {
          title: 'Set up a season',
          detail: 'There is no current season.',
          href: '/admin/season',
        },
      ],
    };
  }
  const { year } = season;
  const week = await getCurrentNflWeek(year, new Date());

  const [
    poolWeek,
    qbWeek,
    locksWeek,
    leagueCount,
    reports,
    jobRuns,
    unmatched,
    registrations,
  ] = await Promise.all([
    week
      ? prisma.poolWeek.findFirst({
          where: { year, weekNumber: week },
          select: { isOpen: true },
        })
      : null,
    week
      ? prisma.qBStreamingWeek.findFirst({
          where: { year, week },
          select: { _count: { select: { QBStreamingWeekOptions: true } } },
        })
      : null,
    week
      ? prisma.locksWeek.findFirst({
          where: { year, weekNumber: week },
          select: { isOpen: true },
        })
      : null,
    prisma.league.count({ where: { year } }),
    week ? prisma.waiverReport.count({ where: { week, league: { year } } }) : 0,
    getScheduledJobRuns(),
    getUnmatchedTeams(year),
    season.isOpenForRegistration ? getRegistrationCountByYear(year) : 0,
  ]);

  const tasks: AdminTask[] = [];

  if (week) {
    if (!poolWeek?.isOpen) {
      tasks.push({
        title: `Spread pool week ${week}`,
        detail: poolWeek
          ? 'The lines are not published yet.'
          : 'The week is not set up yet.',
        href: '/admin/spread-pool',
      });
    }
    if (!qbWeek || qbWeek._count.QBStreamingWeekOptions === 0) {
      tasks.push({
        title: `QB streaming week ${week}`,
        detail: qbWeek
          ? 'The week has no options yet.'
          : 'The week is not set up yet.',
        href: '/admin/qb-streaming',
      });
    }
    if (!locksWeek?.isOpen) {
      tasks.push({
        title: `Locks challenge week ${week}`,
        detail: locksWeek
          ? 'The week is not open yet.'
          : 'The week is not set up yet.',
        href: '/admin/locks-challenge',
      });
    }
    if (leagueCount > 0 && reports < leagueCount) {
      tasks.push({
        title: `Waiver reports for week ${week}`,
        detail: `${reports} of ${leagueCount} leagues posted.`,
        href: '/admin/waivers',
      });
    }
  }

  const failed = Object.values(jobRuns).filter(
    run =>
      run.lastFailedAt &&
      (!run.lastSucceededAt || run.lastFailedAt > run.lastSucceededAt),
  );
  if (failed.length > 0) {
    tasks.push({
      title: `${failed.length} scheduled ${
        failed.length === 1 ? 'job' : 'jobs'
      } failing`,
      detail: `Last run failed: ${failed.map(run => run.name).join(', ')}.`,
      href: '/admin/scheduler',
    });
  }

  const unmatchedCount = unmatched.reduce(
    (total, league) => total + league.unmatchedTeams.length,
    0,
  );
  if (unmatchedCount > 0) {
    tasks.push({
      title: `${unmatchedCount} Sleeper ${
        unmatchedCount === 1 ? 'owner' : 'owners'
      } not matched`,
      detail: 'Teams in this season’s leagues with no member behind them.',
      href: '/admin/members/unmatched',
    });
  }

  if (season.isOpenForRegistration) {
    tasks.push({
      title: 'Registration is open',
      detail: `${registrations} of ${season.registrationSize} spots taken.`,
      href: '/admin/registration-list',
    });
  }

  return { week, tasks };
}
