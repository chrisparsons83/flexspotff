import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import StandingsSection from '~/components/layout/games/StandingsSection';
import LeaderboardTable from '~/components/layout/leaderboard/LeaderboardTable';
import { qbStreamingStandingsEntry } from '~/components/layout/qb-streaming/QBStreamingStandingsRow';
import { TallyBars } from '~/components/ui/bars';
import { Section } from '~/components/ui/section';
import { getQBSelectionsByWeek } from '~/models/qbselection.server';
import type { QBStreamingStandingsRow } from '~/models/qbstreamingweek.server';
import {
  getQBStreamingWeeks,
  getQBStreamingYears,
} from '~/models/qbstreamingweek.server';
import { getCurrentSeason } from '~/models/season.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) => `Week ${params.week}`,
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Response('No season set up yet', { status: 404 });
  }

  const year = Number(params.year || currentSeason.year);
  const week = Number(params.week || '1');

  const [streamingWeeks, years] = await Promise.all([
    getQBStreamingWeeks(year),
    getQBStreamingYears(),
  ]);
  const streamingWeek = streamingWeeks.find(
    streamingWeek => streamingWeek.week === week,
  );
  if (!streamingWeek) throw new Response('No such week', { status: 404 });

  const qbSelections = await getQBSelectionsByWeek(streamingWeek.id);

  const rankings: QBStreamingStandingsRow[] = [];
  for (const qbSelection of qbSelections) {
    rankings.push({
      discordName: qbSelection.user.discordName,
      discordUsername: qbSelection.user.discordUsername,
      pointsScored:
        qbSelection.standardPlayer.pointsScored +
        qbSelection.deepPlayer.pointsScored,
      userId: qbSelection.userId,
    });
  }

  rankings.sort((a, b) => b.pointsScored - a.pointsScored);

  const rankingScoreArray = rankings.map(ranking => ranking.pointsScored);

  for (let i = 0; i < rankings.length; i++) {
    rankings[i].rank =
      rankingScoreArray.findIndex(
        rankingScore => rankingScore === rankings[i].pointsScored,
      ) + 1;
  }

  // How many picked each quarterback on a list, counting a pick only once
  // its game has kicked off, as the rows below do.
  const now = new Date();
  const tally = (side: 'standardPlayer' | 'deepPlayer') => {
    const byOption = new Map<
      string,
      {
        key: string;
        label: string;
        count: number;
        points: number;
        who: string[];
      }
    >();
    let pending = 0;
    for (const selection of qbSelections) {
      const option = selection[side];
      if (option.nflGame.gameStartTime >= now) {
        pending += 1;
        continue;
      }
      const row = byOption.get(option.id) ?? {
        key: option.id,
        label: option.player.fullName,
        count: 0,
        points: option.pointsScored,
        who: [],
      };
      row.count += 1;
      row.who.push(selection.user.discordName);
      byOption.set(option.id, row);
    }
    return {
      // Ties in the count go to whoever scored more.
      tallies: [...byOption.values()]
        .sort((a, b) => b.points - a.points)
        .map(row => ({
          key: row.key,
          label: row.label,
          count: row.count,
          detail: `${row.points.toFixed(2)} pts`,
          who: row.who,
        })),
      pending,
    };
  };

  return typedjson({
    picks: { standard: tally('standardPlayer'), deep: tally('deepPlayer') },
    qbSelections,
    rankings,
    year,
    week,
    weeks: streamingWeeks.map(streamingWeek => streamingWeek.week),
    years,
  });
};

export default function QBStreamingWeekStandings() {
  const { picks, qbSelections, rankings, year, week, weeks, years } =
    useTypedLoaderData<typeof loader>();
  const pending = picks.standard.pending + picks.deep.pending;

  return (
    <>
      <StandingsSection
        base='/games/qb-streaming/standings'
        year={year}
        week={week}
        years={years}
        weeks={weeks}
      >
        <LeaderboardTable
          entries={rankings.map(result =>
            qbStreamingStandingsEntry({
              rank: result.rank,
              user: result,
              pointsScored: result.pointsScored,
              pick: qbSelections.find(pick => pick.userId === result.userId),
            }),
          )}
          nameHeading='Member'
          valueHeadings={['Points']}
          emptyMessage={`No scores yet for week ${week}.`}
        />
      </StandingsSection>
      {qbSelections.length > 0 && (
        <Section
          title='Pick distribution'
          footnote={
            pending > 0 &&
            `${pending} ${
              pending === 1 ? 'pick is' : 'picks are'
            } hidden until their games kick off.`
          }
        >
          <div className='grid gap-x-12 gap-y-10 md:grid-cols-2'>
            {(['standard', 'deep'] as const).map(list => (
              <section key={list}>
                <h3 className='mb-4 text-xl font-extrabold tracking-tight'>
                  {list === 'standard' ? 'Standard' : 'Deep'}
                </h3>
                {picks[list].tallies.length > 0 ? (
                  <TallyBars tallies={picks[list].tallies} />
                ) : (
                  <p className='text-muted-foreground'>
                    No games have kicked off yet.
                  </p>
                )}
              </section>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
