import type { SummaryRow } from '~/components/ui/summary-card';
import { prisma } from '~/db.server';
import { buildStandings as buildBestBallStandings } from '~/libs/best-ball/views';
import { getSeasonLeaders } from '~/libs/games/history.server';
import { pts, teamName } from '~/libs/guillotine/display';
import { cutLineForWeek } from '~/libs/guillotine/views';
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
export async function getSideLeaguesOverview({
  leaders,
  guillotineEach = Math.ceil(leaders / 2),
}: {
  leaders: number;
  /** How many rows from each end of a guillotine week. */
  guillotineEach?: number;
}) {
  const [guillotine, d12, bestBall] = await Promise.all([
    getLatestGuillotineLeagues(),
    getD12Summary(leaders),
    getBestBallSummary(leaders),
  ]);

  return {
    guillotine: guillotine && {
      year: guillotine.year,
      leagues: guillotine.leagues.map(league =>
        guillotineSummary(league, guillotineEach),
      ),
    },
    d12,
    bestBall,
  };
}

type GuillotineLeague = NonNullable<
  Awaited<ReturnType<typeof getLatestGuillotineLeagues>>
>['leagues'][number];

/**
 * A live league: who is left, who went last and at what score, and the
 * survivors who came closest to going with them. A finished one: its podium.
 */
function guillotineSummary(
  league: GuillotineLeague,
  each: number,
): SideLeagueSummary {
  const base = {
    title: league.name,
    to: `/side-leagues/guillotine/${league.id}`,
  };
  const member = (team: GuillotineLeague['teams'][number]) => ({
    user: team.user,
    label: teamName(team),
  });

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

  const scores = league.teams.flatMap(team =>
    team.weekScores.map(score => ({
      rosterId: team.rosterId,
      week: score.week,
      points: score.points,
      players: [],
    })),
  );
  const line = cutLineForWeek(scores, week);
  const alive = league.teams.filter(
    team => team.choppedWeek === null && team.finish !== 1,
  );

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

  // The top and bottom of it, split where they meet if there is a gap.
  const shown =
    table.length <= each * 2
      ? table.map((row, index) => ({ ...row, rank: index + 1 }))
      : [
          ...table
            .slice(0, each)
            .map((row, index) => ({ ...row, rank: index + 1 })),
          ...table.slice(-each).map((row, index) => ({
            ...row,
            rank: table.length - each + index + 1,
          })),
        ];
  const firstChopped = shown.findIndex(row => row.chopped);

  return {
    ...base,
    status: `${alive.length} of ${
      league.teams.length
    } alive after week ${week}.${
      line !== null ? ` The cut was ${pts(line)}.` : ''
    }`,
    rows: shown.map((row, index) => ({
      key: String(row.team.rosterId),
      rank: row.rank,
      ...member(row.team),
      value: pts(row.points),
      divider:
        index === firstChopped
          ? ('cut' as const)
          : index > 0 && row.rank !== shown[index - 1]!.rank + 1
          ? ('gap' as const)
          : undefined,
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
    title: `${year} standings`,
    to: `/side-leagues/d12/${year}`,
    status: week ? `Points through week ${week}.` : 'No weeks scored yet.',
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
    title: `${latest.season.year} standings`,
    to: `/side-leagues/best-ball/${latest.season.year}`,
  };

  const league = await getBestBallLeagueForPage(latest.season.year);
  if (!league) return null;

  return {
    ...base,
    status: league.isComplete
      ? 'Final, by points for.'
      : league.lastScoredWeek > 0
      ? `Points for through week ${league.lastScoredWeek}.`
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
