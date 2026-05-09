import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  submitRaceSeriesSubscriptionBooking,
  submitRemoveRaceSeriesSubscription,
} from '~/lib/bookings/actions.server';
import { loadRaceSeriesDetail } from '~/lib/days/series-detail.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
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

export async function action({ params, request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (!formData.get('seriesKey') && params.seriesKey) {
    formData.set('seriesKey', params.seriesKey);
  }

  const result =
    intent === 'removeRaceSeries'
      ? await submitRemoveRaceSeriesSubscription(formData, user.id)
      : intent === 'addRaceSeries'
        ? await submitRaceSeriesSubscriptionBooking(formData, user)
        : {
            ok: false as const,
            formError: 'This series action is not supported.',
            fieldErrors: {},
          };

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action:
        intent === 'removeRaceSeries' ? 'seriesSubscription.removed' : 'seriesSubscription.added',
      message:
        intent === 'removeRaceSeries'
          ? 'Series removed from the series page.'
          : `${
              'seriesName' in result ? result.seriesName : 'Race series'
            } added from the series page.`,
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'seriesSubscription',
        id: result.seriesKey,
      },
      metadata: {
        status: 'status' in result ? result.status : undefined,
        addedCount: 'addedCount' in result ? result.addedCount : undefined,
        existingCount: 'existingCount' in result ? result.existingCount : undefined,
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function RaceSeriesDetailRoute() {
  const data = useLoaderData<typeof loader>() as RaceSeriesDetailPageProps;
  return <RaceSeriesDetailPage {...data} />;
}
