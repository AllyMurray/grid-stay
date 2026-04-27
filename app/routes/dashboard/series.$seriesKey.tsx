import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { loadRaceSeriesDetail } from '~/lib/days/series-detail.server';
import {
  RaceSeriesDetailPage,
  type RaceSeriesDetailPageProps,
} from '~/pages/dashboard/series-detail';
import type { Route } from './+types/series.$seriesKey';

export async function loader({ params, request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const detail = await loadRaceSeriesDetail(user, params.seriesKey ?? '');

  if (!detail) {
    throw new Response('Race series not found', {
      status: 404,
      headers,
    });
  }

  return Response.json(detail satisfies RaceSeriesDetailPageProps, {
    headers,
  });
}

export default function RaceSeriesDetailRoute() {
  const data = useLoaderData<typeof loader>() as RaceSeriesDetailPageProps;
  return <RaceSeriesDetailPage {...data} />;
}
