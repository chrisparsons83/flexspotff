import type { LoaderFunctionArgs } from '@remix-run/node';
import { Outlet } from '@remix-run/react';
import { typedjson, useTypedLoaderData } from 'remix-typedjson';
import { d12Tabs } from '~/components/layout/side-leagues/tabs';
import GoBox from '~/components/ui/GoBox';
import { PageHeader } from '~/components/ui/page-header';
import { SubNav } from '~/components/ui/sub-nav';
import { getAllD12SeasonYears } from '~/models/d12season.server';
import { getNewestD12WeekByYear } from '~/models/d12weekscore.server';
import type { RouteHandle } from '~/utils/route-handle';

export const handle: RouteHandle = { title: 'D12' };

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const years = await getAllD12SeasonYears();
  // The season in the URL, or the newest one on the history page.
  const year = params.year ? Number(params.year) : years[0];
  const week =
    year && Number.isInteger(year) ? await getNewestD12WeekByYear(year) : null;

  return typedjson({
    years,
    season: year && Number.isInteger(year) ? { year, week } : null,
  });
};

export default function D12() {
  const { years, season } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader
        title={season ? `D12 ${season.year}` : 'D12'}
        nav={
          <SubNav
            label='D12'
            items={d12Tabs(season)}
            picker={
              years.length > 1 && (
                <GoBox
                  buttonText='Season'
                  options={years.map(year => ({
                    label: `${year}`,
                    url: `/side-leagues/d12/${year}`,
                  }))}
                />
              )
            }
          />
        }
      />
      <Outlet />
    </>
  );
}
