import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return {};
};

export default function QBStreaming() {
  return <Outlet />;
}
