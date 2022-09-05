import type { LoaderArgs } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

export const loader = async ({ request }: LoaderArgs) => {
  return {};
};

export default function QBStreaming() {
  return <Outlet />;
}
