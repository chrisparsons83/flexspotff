import { useState } from "react";

export default function GamesSpreadPoolWeek() {
  const initialBudget = 1200;
  const teams = ["Denver (+4.5)", "Miami (-4.5)"];
  const [betAmount, setBetAmount] = useState<{
    teamName: string;
    amount: number;
  }>({ teamName: "", amount: 0 });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const actualValue = Number.parseInt(e.target.value);
    const amount = Math.abs(actualValue);
    const teamName =
      actualValue > 0 ? teams[1] : actualValue < 0 ? teams[0] : "No Bet";
    setBetAmount({
      teamName,
      amount,
    });
  };

  const betDisplay =
    betAmount.amount !== 0
      ? `${betAmount.amount} on ${betAmount.teamName}`
      : "No Bet";

  return (
    <>
      <h2>Week Entry</h2>
      <div className="mb-4">
        <div>Available to bet: {initialBudget - betAmount.amount}</div>
        <div>Amount currently bet: {betAmount.amount}</div>
      </div>
      <div className="grid md:grid-cols-2">
        <div>
          <div className="flex gap-2 justify-between">
            <div className="w-1/3">{teams[0]}</div>
            <div className="text-center">vs.</div>
            <div className="w-1/3 text-right">{teams[1]}</div>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="10"
            name="denverVsMiami"
            defaultValue={0}
            className="w-full"
            onChange={handleChange}
          />
          <div>Current Bet: {betDisplay}</div>
        </div>
      </div>
    </>
  );
}
