import { Link } from "@remix-run/react";

export default function FSquaredIndex() {
  return (
    <>
      <h2>F²</h2>
      <div>
        <h3>My entry</h3>
        <p>Status: Not Entered</p>
        <p>
          <Link to="my-entry">Edit My Entry</Link>
        </p>
      </div>
      <section>
        <h3>Standings</h3>
      </section>
    </>
  );
}
