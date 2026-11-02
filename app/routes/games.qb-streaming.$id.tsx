import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';

/** The old address of a week's entry, before it moved under My entries. */
export const loader = ({ params }: LoaderFunctionArgs) => {
  throw redirect(`/games/qb-streaming/entries/${params.id}`, 301);
};
