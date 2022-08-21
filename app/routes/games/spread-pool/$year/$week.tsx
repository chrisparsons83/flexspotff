export default function GamesSpreadPoolWeek() {
  return (
    <>
      <h2>Week Entry</h2>
      <div className="mb-4">
        <div>Available to bet: 1180</div>
        <div>Amount currently bet: 20</div>
      </div>
      <div className="grid md:grid-cols-2">
        <div>
          <div className="flex gap-2 justify-between">
            <div className="w-1/3">Denver (+4.5)</div>
            <div className="text-center">vs.</div>
            <div className="w-1/3 text-right">Miami (-4.5)</div>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="10"
            name="denverVsMiami"
            defaultValue={0}
            className="w-full"
          />
          <div>Current Bet: 20 on Miami (-4.5)</div>
        </div>
      </div>
    </>
  );
}
