import type { LoaderFunctionArgs } from '@remix-run/node';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { EmptyState } from '~/components/ui/empty-state';
import { Link } from '~/components/ui/link';
import { Section } from '~/components/ui/section';
import { PositionMark } from '~/components/ui/swatch';
import { Table, useTableSort } from '~/components/ui/table';
import { getD12DraftPicksByUserAndLeagues } from '~/models/d12draftpick.server';
import { getD12SeasonByYear } from '~/models/d12season.server';
import type { Player } from '~/models/players.server';
import { getPlayersBySleepersIds } from '~/models/players.server';
import { getUserById } from '~/models/user.server';
import { type RouteHandle, dataOf } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ data, params }) => {
    const name = dataOf<typeof loader>(data)?.discordName;
    return name && `${name}, ${params.year}`;
  },
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { year: yearParam, userId } = params;
  if (!yearParam || !userId) {
    throw new Response('Member not found', { status: 404 });
  }
  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 2025) {
    throw new Response('Season not found', { status: 404 });
  }

  const [season, user] = await Promise.all([
    getD12SeasonByYear(year),
    getUserById(userId),
  ]);

  if (!season) throw new Response('Season not found', { status: 404 });
  if (!user) throw new Response('Member not found', { status: 404 });

  const leagueIds = season.leagues.map(l => l.id);
  const allPicks = await getD12DraftPicksByUserAndLeagues(userId, leagueIds);

  const playerMap = new Map<string, { count: number; picks: number[] }>();
  for (const pick of allPicks) {
    const existing = playerMap.get(pick.sleeperId) ?? { count: 0, picks: [] };
    existing.count++;
    existing.picks.push(pick.pickNo);
    playerMap.set(pick.sleeperId, existing);
  }

  const ownership = Array.from(playerMap.entries()).map(
    ([sleeperId, data]) => ({
      sleeperId,
      leagueCount: data.count,
      avgPick: data.picks.reduce((a, b) => a + b, 0) / data.picks.length,
    }),
  );

  const players = await getPlayersBySleepersIds(
    ownership.map(o => o.sleeperId),
  );
  const playersMap = new Map<string, Player>();
  for (const player of players) {
    if (player.sleeperId) playersMap.set(player.sleeperId, player);
  }

  return typedjson({
    ownership,
    playersMap,
    discordName: user.discordName,
    year,
    totalLeagues: season.leagues.length,
  });
};

export default function D12MemberRoster() {
  const { ownership, playersMap, discordName, year, totalLeagues } =
    useTypedLoaderData<typeof loader>();

  const { rows, sort } = useTableSort(
    ownership,
    {
      player: item => playersMap.get(item.sleeperId)?.fullName ?? null,
      position: item => playersMap.get(item.sleeperId)?.position ?? null,
      leagueCount: item => item.leagueCount,
      avgPick: item => item.avgPick,
    },
    { key: 'leagueCount' },
  );

  return (
    <Section
      title={`${discordName}’s roster`}
      description={`Every player they drafted across ${totalLeagues} leagues.`}
      action={<Link to={`/side-leagues/d12/${year}`}>{year} standings</Link>}
    >
      {ownership.length === 0 ? (
        <EmptyState title='No picks for this member this season' />
      ) : (
        <Table
          headers={['Player', 'Position', 'Leagues owned', 'Average pick']}
          numericColumns={[2, 3]}
          sortKeys={{
            0: 'player',
            1: 'position',
            2: 'leagueCount',
            3: 'avgPick',
          }}
          sort={sort}
        >
          {rows.map(item => {
            const playerInfo = playersMap.get(item.sleeperId);
            return (
              <tr key={item.sleeperId}>
                <td>{playerInfo?.fullName ?? item.sleeperId}</td>
                <td>
                  <PositionMark position={playerInfo?.position ?? null} />
                </td>
                <td className='text-right'>
                  {item.leagueCount} of {totalLeagues}
                </td>
                <td className='text-right'>{item.avgPick.toFixed(1)}</td>
              </tr>
            );
          })}
        </Table>
      )}
    </Section>
  );
}
