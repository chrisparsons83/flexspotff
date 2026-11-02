import type { LoaderFunctionArgs } from '@remix-run/node';
import { useTypedLoaderData } from 'remix-typedjson';
import CupPage from '~/components/layout/cup/CupPage';
import { loadCupPage } from '~/libs/cup/bracket.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = {
  title: ({ params }) => `${params.year} Cup`,
};

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (!/^\d+$/.test(params.year ?? '')) {
    throw new Response('No cup that year', { status: 404 });
  }
  return loadCupPage(Number(params.year));
};

export default function CupYear() {
  return <CupPage {...useTypedLoaderData<typeof loader>()} />;
}
