import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';

/** The League tab is the default view. */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  return redirect(`/members/${params.userId}/league`);
};
