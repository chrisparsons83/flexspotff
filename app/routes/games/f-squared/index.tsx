import { Link } from "@remix-run/react";

export default function FSquaredIndex() {
  return (
    <>
      <h2>F²</h2>
      <p>
        Pick two teams from each league before they draft. Get points based on
        how many fantasy points they earn during the season. Most combined
        points wins.
      </p>
      <p>
        You are able to change your picks for a league until that league's draft
        starts. Teams are listed by their draft order.
      </p>
      <div>
        <h3>My entry</h3>
        <p>Status: Not Entered</p>
        <p>
          <Link to="my-entry">View/Edit My Entry</Link>
        </p>
      </div>
      <section>
        <h3>Standings</h3>
      </section>
    </>
  );
}
