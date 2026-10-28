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

/** Guillotine and Autodraft BBM are for members. */
const MEMBERS_ONLY = 'Log in to see the standings.';

const PLACES = ['Champion', 'Runner-up', 'Third'];

/**
 * This season's side leagues at a glance: each guillotine league's survivors
 * and chop line, the D12 leaders and the Autodraft BBM leaders.
 */
export async function getSideLeaguesOverview({
  signedIn,
  leaders,
}: {
  signedIn: boolean;
  leaders: number;
}) {
  const [guillotine, d12, bestBall] = await Promise.all([
    getLatestGuillotineLeagues(),
    getD12Summary(leaders),
    getBestBallSummary(signedIn, leaders),
  ]);

  return {
    guillotine: guillotine && {
      year: guillotine.year,
      leagues: guillotine.leagues.map(league =>
        signedIn
          ? guillotineSummary(league, leaders)
          : {
              title: league.name,
              to: `/side-leagues/guillotine/${league.id}`,
              status: '',
              rows: [],
              empty: MEMBERS_ONLY,
            },
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
  count: number,
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
  const chopped = league.teams.filter(team => team.choppedWeek === week);
  const alive = league.teams.filter(
    team => team.choppedWeek === null && team.finish !== 1,
  );
  const closest = alive
    .map(team => ({
      team,
      points: team.weekScores.find(score => score.week === week)?.points,
    }))
    .filter(
      (row): row is typeof row & { points: number } => row.points !== undefined,
    )
    .sort((a, b) => a.points - b.points)
    .slice(0, count);

  return {
    ...base,
    status: `${alive.length} of ${
      league.teams.length
    } alive after week ${week}.${
      chopped.length > 0 && line !== null
        ? ` ${chopped.map(teamName).join(' and ')} went at ${pts(line)}.`
        : ''
    } Closest calls:`,
    rows: closest.map(({ team, points }) => ({
      key: String(team.rosterId),
      ...member(team),
      value: line === null ? pts(points) : `+${pts(points - line)}`,
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
  signedIn: boolean,
  count: number,
): Promise<SideLeagueSummary | null> {
  const latest = await getLatestBestBallLeague();
  if (!latest) return null;
  const base = {
    title: `${latest.season.year} standings`,
    to: `/side-leagues/best-ball/${latest.season.year}`,
  };
  if (!signedIn) return { ...base, status: '', rows: [], empty: MEMBERS_ONLY };

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
