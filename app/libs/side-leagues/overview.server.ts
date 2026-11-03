import type { SummaryRow } from '~/components/ui/summary-card';
import { prisma } from '~/db.server';
import { buildStandings as buildBestBallStandings } from '~/libs/best-ball/views';
import { getSeasonLeaders } from '~/libs/games/history.server';
import { GUILLOTINE_FINAL_WEEK } from '~/libs/guillotine/chops';
import { pts, teamName } from '~/libs/guillotine/display';
import { buildLiveChopLine } from '~/libs/guillotine/live.server';
import type { LiveChopLine } from '~/libs/guillotine/live.server';
import {
  getBestBallLeagueForPage,
  getLatestBestBallLeague,
} from '~/models/bestball.server';
import { getLatestD12Season } from '~/models/d12season.server';
import { getLatestGuillotineLeagues } from '~/models/guillotine.server';
import { d12SeasonTotals } from '~/models/profile/sideGameSeasons.server';

export type SideLeagueSummary = {
  title: string;
  to: string;
  status: string;
  rows: SummaryRow[];
  empty: string;
};

const PLACES = ['Champion', 'Runner-up', 'Third'];

/**
 * This season's side leagues at a glance: each guillotine league's survivors
 * and chop line, the D12 leaders and the Autodraft BBM leaders.
 */
export async function getSideLeaguesOverview({ leaders }: { leaders: number }) {
  const [guillotine, d12, bestBall] = await Promise.all([
    getLatestGuillotineLeagues(),
    getD12Summary(leaders),
    getBestBallSummary(leaders),
  ]);

  return {
    guillotine: guillotine && {
      year: guillotine.year,
      leagues: await Promise.all(
        guillotine.leagues.map(league =>
          guillotineSummary(league, guillotine.year),
        ),
      ),
    },
    d12,
    bestBall,
  };
}

type GuillotineLeague = NonNullable<
  Awaited<ReturnType<typeof getLatestGuillotineLeagues>>
>['leagues'][number];

const member = (team: GuillotineLeague['teams'][number]) => ({
  user: team.user,
  label: teamName(team),
});

/** A guillotine card's title, naming the week its table is for. */
const weekTitle = (name: string, week: number) => `${name} · Week ${week}`;

/**
 * A week being played: every surviving team's points so far, ranked by where
 * it is projected to finish, with the chop line above the team on course to
 * go. Once a team's games are over its projection is just its score, so it is
 * left out.
 */
export function liveGuillotineSummary({
  league,
  week,
  live,
}: {
  league: Pick<GuillotineLeague, 'id' | 'name' | 'teams'>;
  week: number;
  live: (Pick<
    LiveChopLine[number],
    'rosterId' | 'points' | 'projected' | 'playersRemaining' | 'lineupSet'
  > & { rank: number; onTheBlock: boolean })[];
}): SideLeagueSummary {
  const teamByRoster = new Map(league.teams.map(t => [t.rosterId, t]));
  const onTheBlock = live.findIndex(row => row.onTheBlock);

  return {
    title: weekTitle(league.name, week),
    to: `/side-leagues/guillotine/${league.id}`,
    status: '',
    rows: live.flatMap((row, index) => {
      const team = teamByRoster.get(row.rosterId);
      if (!team) return [];
      return [
        {
          key: String(row.rosterId),
          rank: row.rank,
          ...member(team),
          value: pts(row.points),
          detail: !row.lineupSet
            ? 'No lineup'
            : row.playersRemaining > 0
            ? `Proj. ${pts(row.projected, 1)}`
            : undefined,
          divider: index === onTheBlock ? ('cut' as const) : undefined,
          tone: row.onTheBlock ? ('negative' as const) : undefined,
        },
      ];
    }),
    empty: 'No scores for the week yet.',
  };
}

/**
 * A league mid-week: the live chop line, from the first points of the week
 * until Sleeper closes it. Between weeks: the last week's table, with whoever
 * was chopped below the line. A finished one: its podium.
 */
async function guillotineSummary(
  league: GuillotineLeague,
  year: number,
): Promise<SideLeagueSummary> {
  const base = {
    title: league.name,
    to: `/side-leagues/guillotine/${league.id}`,
  };

  const liveWeek = league.lastScoredWeek + 1;
  const isPlayingLiveWeek =
    !league.isComplete &&
    league.lastScoredWeek < GUILLOTINE_FINAL_WEEK &&
    league.teams.some(team =>
      team.weekScores.some(s => s.week === liveWeek && s.points > 0),
    );
  if (isPlayingLiveWeek) {
    const live = await buildLiveChopLine({
      year,
      week: liveWeek,
      teams: league.teams,
    });
    return liveGuillotineSummary({ league, week: liveWeek, live });
  }

  if (league.isComplete) {
    return {
      ...base,
      status: 'Final.',
      rows: PLACES.flatMap((place, index) => {
        const team = league.teams.find(t => t.finish === index + 1);
        return team
          ? [{ key: String(team.rosterId), ...member(team), value: place }]
          : [];
      }),
      empty: 'No finishing places recorded.',
    };
  }

  const week = league.lastScoredWeek;
  if (week === 0) {
    return {
      ...base,
      status: `${league.teams.length} teams, nobody chopped yet.`,
      rows: [],
      empty: 'The first chop comes after week 1.',
    };
  }

  // The week's table, best first: everyone who played it, the chopped last.
  const table = league.teams
    .filter(team => team.choppedWeek === null || team.choppedWeek >= week)
    .flatMap(team => {
      const points = team.weekScores.find(score => score.week === week)?.points;
      return points === undefined
        ? []
        : [{ team, points, chopped: team.choppedWeek === week }];
    })
    .sort((a, b) =>
      a.chopped !== b.chopped ? (a.chopped ? 1 : -1) : b.points - a.points,
    );

  const firstChopped = table.findIndex(row => row.chopped);

  return {
    ...base,
    title: weekTitle(league.name, week),
    status: '',
    rows: table.map((row, index) => ({
      key: String(row.team.rosterId),
      rank: index + 1,
      ...member(row.team),
      value: pts(row.points),
      divider: index === firstChopped ? ('cut' as const) : undefined,
      tone: row.chopped ? ('negative' as const) : undefined,
    })),
    empty: 'No scores for the week yet.',
  };
}

async function getD12Summary(count: number): Promise<SideLeagueSummary | null> {
  const season = await getLatestD12Season();
  if (!season) return null;
  const { year } = season;

  const [totals, latest] = await Promise.all([
    d12SeasonTotals([year]),
    prisma.d12WeekScore.aggregate({
      where: { league: { season: { year } } },
      _max: { week: true },
    }),
  ]);
  const week = latest._max.week;

  return {
    title: `${year} Standings`,
    to: `/side-leagues/d12/${year}`,
    status: week ? `Through week ${week}` : 'No weeks scored yet.',
    rows: (await getSeasonLeaders(totals, year, count)).map(row => ({
      key: row.user.id,
      rank: row.rank,
      user: row.user,
      value: pts(row.total),
    })),
    empty: 'No scores yet this season.',
  };
}

async function getBestBallSummary(
  count: number,
): Promise<SideLeagueSummary | null> {
  const latest = await getLatestBestBallLeague();
  if (!latest) return null;
  const base = {
    title: `${latest.season.year} Standings`,
    to: `/side-leagues/best-ball/${latest.season.year}`,
  };

  const league = await getBestBallLeagueForPage(latest.season.year);
  if (!league) return null;

  // The newest week in the totals, which includes the one being played. Sleeper
  // only moves lastScoredWeek on once that week closes.
  const newestWeek = Math.max(
    0,
    ...league.teams.flatMap(team => team.weekScores.map(score => score.week)),
  );

  return {
    ...base,
    status: league.isComplete
      ? 'Final, by points for.'
      : newestWeek > 0
      ? `Through week ${newestWeek}`
      : 'No weeks scored yet.',
    rows: buildBestBallStandings(league.teams)
      .slice(0, count)
      .map(row => ({
        key: String(row.rosterId),
        rank: row.rank,
        user: row.user,
        label: teamName(row),
        value: pts(row.pointsFor),
      })),
    empty: 'No scores yet this season.',
  };
}
