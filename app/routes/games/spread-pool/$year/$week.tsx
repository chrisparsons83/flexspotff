import type { ActionArgs, LoaderArgs } from "@remix-run/node";
import { Form, useTransition } from "@remix-run/react";
import { useState } from "react";

import type { Bet } from "~/models/poolgame.server";
import { getPoolGamesByYearAndWeek } from "~/models/poolgame.server";
import type { PoolWeek } from "~/models/poolweek.server";
import { getPoolWeekByYearAndWeek } from "~/models/poolweek.server";
import type { User } from "~/models/user.server";

import SpreadPoolGameComponent from "~/components/layout/spread-pool/SpreadPoolGame";
import Button from "~/components/ui/Button";
import { authenticator, requireAdmin } from "~/services/auth.server";
import { superjson, useSuperLoaderData } from "~/utils/data";

type LoaderData = {
  user?: User;
  poolWeek?: PoolWeek;
  poolGames?: Awaited<ReturnType<typeof getPoolGamesByYearAndWeek>>;
  notOpenYet?: string;
};

export const action = async ({ params, request }: ActionArgs) => {
  const formData = await request.formData();
  for (const entry of formData.entries()) {
    console.log(entry);
  }

  return {};
};

export const loader = async ({ params, request }: LoaderArgs) => {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  requireAdmin(user);

  const year = params.year;
  const week = params.week;

  if (!year) throw new Error(`No year set`);
  if (!week) throw new Error(`No week set`);

  const poolWeek = await getPoolWeekByYearAndWeek(+year, +week);

  if (!poolWeek) {
    return superjson<LoaderData>({
      notOpenYet: "Week has not been created yet.",
    });
  }
  if (!poolWeek.isOpen) {
    return superjson<LoaderData>({
      notOpenYet: "Lines have not been set for this week yet.",
    });
  }

  const poolGames = await getPoolGamesByYearAndWeek(+year, +week);

  return superjson<LoaderData>(
    { user, poolWeek, poolGames },
    { headers: { "x-superjson": "true" } }
  );
};

export default function GamesSpreadPoolWeek() {
  const { notOpenYet, poolGames } = useSuperLoaderData<typeof loader>();
  const transition = useTransition();

  const initialBudget = 100;
  const [bets, setBets] = useState<Bet[]>([]);

  const handleChange = (bets: Bet[]) => {
    console.log(bets);
    setBets((prevBets) => {
      const newBetTeamIds = bets.map((bet) => bet.teamId);
      const cleanedBets = prevBets.filter(
        (prevBet) => !newBetTeamIds.includes(prevBet.teamId)
      );
      return [...cleanedBets, ...bets];
    });
  };

  const betAmount = bets.reduce((a, b) => a + b.amount, 0);
  const availableToBet = initialBudget - betAmount;

  const disableSubmit = transition.state !== "idle" || availableToBet < 0;

  return (
    <>
      <h2>Week Entry</h2>
      <Form method="post">
        {notOpenYet || (
          <>
            <div className="mb-4">
              <div>Available to bet: {availableToBet}</div>
              <div>Amount currently bet: {betAmount}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-12">
              {poolGames?.map((poolGame) => (
                <SpreadPoolGameComponent
                  key={poolGame.id}
                  handleChange={handleChange}
                  poolGame={poolGame}
                />
              ))}
            </div>
            <div className="m-4">
              {availableToBet < 0 && (
                <p className="text-red-500">
                  You cannot bet more than your available budget, which is
                  currently {availableToBet}.
                </p>
              )}
              <Button type="submit" disabled={disableSubmit}>
                Update Picks
              </Button>
            </div>
          </>
        )}
      </Form>
    </>
  );
}
