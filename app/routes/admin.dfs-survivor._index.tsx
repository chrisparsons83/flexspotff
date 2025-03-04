import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form } from '@remix-run/react';
import { typedjson, useTypedActionData, useTypedLoaderData } from 'remix-typedjson';
import type { DFSSurvivorUserWeek, Season, DFSSurvivorUserEntry, Player } from '@prisma/client';
import { getCurrentSeason } from '~/models/season.server';
import Alert from '~/components/ui/Alert';
import Button from '~/components/ui/Button';
import { authenticator, requireAdmin } from '~/services/auth.server';
import { prisma } from '~/db.server';
import z from 'zod';

type WeekWithEntries = DFSSurvivorUserWeek & {
  entries: (DFSSurvivorUserEntry & {
    player: Player;
  })[];
};

type LoaderData = {
  dfsSurvivorWeeks: WeekWithEntries[];
  currentSeason: Season;
};

// If the below fields do not exist, it is safe to assume they are 0.
const sleeperJsonStats = z.record(
  z.object({
    pts_ppr: z.number().optional(),
    pass_yd: z.number().optional(),
    pass_td: z.number().optional(),
    rush_yd: z.number().optional(),
    rush_td: z.number().optional(),
    rec_yd: z.number().optional(),
    rec_td: z.number().optional(),
    rec: z.number().optional(),
    pass_int: z.number().optional(),
    fum_lost: z.number().optional(),
    rush_2pt: z.number().optional(),
    rec_2pt: z.number().optional(),
    pass_2pt: z.number().optional(),
    off_fum_rec_td: z.number().optional(),
    punt_ret_td: z.number().optional(),
    kick_ret_td: z.number().optional(),
    def_int_td: z.number().optional(),
    def_fum_rec_td: z.number().optional(),
    def_sack: z.number().optional(),
    def_tackle_for_loss: z.number().optional(),
    def_safety: z.number().optional(),
    def_blocked_kick: z.number().optional(),
    def_int: z.number().optional(),
    def_fum_rec: z.number().optional(),
    def_pts_allowed: z.number().optional(),
    def_yds_allowed: z.number().optional(),
    fg_0_19: z.number().optional(),
    fg_20_29: z.number().optional(),
    fg_30_39: z.number().optional(),
    fg_40_49: z.number().optional(),
    fg_50_plus: z.number().optional(),
    xpt: z.number().optional(),
  }),
);
type SleeperJsonStats = z.infer<typeof sleeperJsonStats>;

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const formData = await request.formData();
  const _action = formData.get('_action');

  if (_action === 'createNewWeek') {
    const currentSeason = await getCurrentSeason();
    if (!currentSeason) {
      throw new Error('No active season currently');
    }
  } else if (_action === 'scoreWeek') {
    const weekNumberString = formData.get('weekNumber');
    const yearString = formData.get('year');
    const id = formData.get('id');

    if (
      typeof weekNumberString !== 'string' ||
      typeof yearString !== 'string' ||
      typeof id !== 'string'
    ) {
      throw new Error('Form has not been formed correctly');
    }

    const dfsSurvivorWeek = await prisma.dFSSurvivorUserWeek.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            player: true,
          },
        },
      },
    });

    if (!dfsSurvivorWeek) {
      throw new Error('DFS Survivor Week not found');
    }

    const year = Number(yearString);
    const weekNumber = Number(weekNumberString);

    // Fetch stats from Sleeper API
    const sleeperLeagueRes = await fetch(
      `https://api.sleeper.app/v1/stats/nfl/regular/${year}/${weekNumber}`,
    );
    const sleeperJson: SleeperJsonStats = sleeperJsonStats.parse(
      await sleeperLeagueRes.json(),
    );

    const promises: Promise<any>[] = [];
    for (const entry of dfsSurvivorWeek.entries) {
      const stats = sleeperJson[entry.player.sleeperId] || {};
      let score = 0;

      // Calculate points based on position and stats
      if (entry.player.position === 'QB') {
        score =
          Math.round(
            100 *
              (0.04 * (stats.pass_yd || 0) +
                4 * (stats.pass_td || 0) +
                0.1 * (stats.rush_yd || 0) +
                6 * (stats.rush_td || 0) +
                0.1 * (stats.rec_yd || 0) +
                6 * (stats.rec_td || 0) +
                -2 * (stats.fum_lost || 0) +
                -2 * (stats.pass_int || 0) +
                2 * (stats.pass_2pt || 0) +
                2 * (stats.rush_2pt || 0) +
                2 * (stats.rec_2pt || 0)),
          ) / 100;
      } else if (entry.player.position === 'RB') {
        score =
          Math.round(
            100 *
              (0.1 * (stats.rush_yd || 0) +
                6 * (stats.rush_td || 0) +
                0.5 * (stats.rec || 0) +
                0.1 * (stats.rec_yd || 0) +
                6 * (stats.rec_td || 0) +
                -2 * (stats.fum_lost || 0) +
                2 * (stats.rush_2pt || 0) +
                2 * (stats.rec_2pt || 0)),
          ) / 100;
      } else if (entry.player.position === 'WR') {
        score =
          Math.round(
            100 *
              (0.5 * (stats.rec || 0) +
                0.1 * (stats.rec_yd || 0) +
                6 * (stats.rec_td || 0) +
                0.1 * (stats.rush_yd || 0) +
                6 * (stats.rush_td || 0) +
                -2 * (stats.fum_lost || 0) +
                2 * (stats.rec_2pt || 0) +
                2 * (stats.rush_2pt || 0)),
          ) / 100;
      } else if (entry.player.position === 'TE') {
        score =
          Math.round(
            100 *
              (0.5 * (stats.rec || 0) +
                0.1 * (stats.rec_yd || 0) +
                6 * (stats.rec_td || 0) +
                0.1 * (stats.rush_yd || 0) +
                6 * (stats.rush_td || 0) +
                -2 * (stats.fum_lost || 0) +
                2 * (stats.rec_2pt || 0) +
                2 * (stats.rush_2pt || 0)),
          ) / 100;
      } else if (entry.player.position === 'K') {
        score =
          Math.round(
            100 *
              (3 * (stats.fg_0_19 || 0) +
                3 * (stats.fg_20_29 || 0) +
                3 * (stats.fg_30_39 || 0) +
                4 * (stats.fg_40_49 || 0) +
                5 * (stats.fg_50_plus || 0) +
                1 * (stats.xpt || 0)),
          ) / 100;
      } else if (entry.player.position === 'DST') {
        let defPoints = 0;
        // Points allowed
        if (stats.def_pts_allowed) {
          if (stats.def_pts_allowed === 0) defPoints += 10;
          else if (stats.def_pts_allowed < 7) defPoints += 7;
          else if (stats.def_pts_allowed < 14) defPoints += 4;
          else if (stats.def_pts_allowed < 21) defPoints += 1;
          else if (stats.def_pts_allowed < 28) defPoints -= 1;
          else if (stats.def_pts_allowed < 35) defPoints -= 2;
          else defPoints -= 3;
        }
        // Yards allowed
        if (stats.def_yds_allowed) {
          if (stats.def_yds_allowed < 100) defPoints += 5;
          else if (stats.def_yds_allowed < 200) defPoints += 3;
          else if (stats.def_yds_allowed < 300) defPoints += 2;
          else if (stats.def_yds_allowed < 400) defPoints -= 1;
          else if (stats.def_yds_allowed < 500) defPoints -= 2;
          else defPoints -= 3;
        }
        // Other defensive stats
        defPoints +=
          6 * (stats.def_int_td || 0) +
          6 * (stats.def_fum_rec_td || 0) +
          8 * (stats.punt_ret_td || 0) +
          8 * (stats.kick_ret_td || 0) +
          2 * (stats.def_int || 0) +
          2 * (stats.def_fum_rec || 0) +
          4 * (stats.def_safety || 0) +
          1 * (stats.def_sack || 0) +
          3 * (stats.def_blocked_kick || 0) +
          0.5 * (stats.def_tackle_for_loss || 0);
        score = Math.round(100 * defPoints) / 100;
      }

      promises.push(
        prisma.dFSSurvivorUserEntry.update({
          where: {
            id: entry.id,
          },
          data: {
            points: score,
          },
        }),
      );
    }

    await Promise.all(promises);

    await prisma.dFSSurvivorUserWeek.update({
      where: {
        id: dfsSurvivorWeek.id,
      },
      data: {
        isScored: true,
      },
    });

    return typedjson({ message: 'Week has been scored.' });
  }

  return typedjson({ message: 'Invalid action' });
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: '/login',
  });
  requireAdmin(user);

  const currentSeason = await getCurrentSeason();
  if (!currentSeason) {
    throw new Error('No active season currently');
  }

  try {
    const dfsSurvivorWeeks = await prisma.dFSSurvivorUserWeek.findMany({
      where: {
        year: currentSeason.year,
      },
      include: {
        entries: {
          include: {
            player: true,
          },
        },
      },
      orderBy: {
        week: 'desc',
      },
    });
    return typedjson<LoaderData>({ dfsSurvivorWeeks, currentSeason });
  } catch (error) {
    console.error('Error fetching DFS Survivor weeks:', error);
    throw new Error('Failed to fetch DFS Survivor weeks');
  }
};

export default function AdminDfsSurvivorIndex() {
  const { dfsSurvivorWeeks } = useTypedLoaderData<typeof loader>();
  const actionData = useTypedActionData<typeof action>();

  return (
    <>
      <h2>DFS Survivor</h2>
      {actionData?.message && <Alert message={actionData.message} />}
      <Form method='POST'>
      </Form>
      <table className='w-full'>
        <thead>
          <tr>
            <th>Week</th>
            <th>Scored</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {dfsSurvivorWeeks.map((week: WeekWithEntries) => (
            <tr key={week.id}>
              <td>{week.week}</td>
              <td>{week.isScored ? 'Yes' : 'No'}</td>
              <td>
                <Form method='POST'>
                  <input type='hidden' name='weekNumber' value={week.week} />
                  <input type='hidden' name='year' value={week.year} />
                  <input type='hidden' name='id' value={week.id} />
                  <Button type='submit' name='_action' value='scoreWeek'>
                    Score Week
                  </Button>
                </Form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
} 