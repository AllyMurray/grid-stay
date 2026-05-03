import { type ShouldRevalidateFunctionArgs, useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  submitBulkRaceSeriesBooking,
  submitCreateBooking,
  submitSharedStaySelection,
} from '~/lib/bookings/actions.server';
import type { DaysIndexData } from '~/lib/days/dashboard-feed.server';
import { loadDaysIndex } from '~/lib/days/dashboard-feed.server';
import {
  submitClearSavedDaysFilters,
  submitSaveDaysFilters,
} from '~/lib/days/preferences.server';
import { submitSharedDayPlan } from '~/lib/days/shared-plan.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { submitGarageShareRequest } from '~/lib/garage-sharing/actions.server';
import { AvailableDaysPage } from '~/pages/dashboard/days';
import type { Route } from './+types/days';

type AvailableDaysActionResult =
  | Awaited<ReturnType<typeof submitSaveDaysFilters>>
  | Awaited<ReturnType<typeof submitClearSavedDaysFilters>>
  | Awaited<ReturnType<typeof submitSharedStaySelection>>
  | Awaited<ReturnType<typeof submitBulkRaceSeriesBooking>>
  | Awaited<ReturnType<typeof submitCreateBooking>>
  | Awaited<ReturnType<typeof submitSharedDayPlan>>
  | Awaited<ReturnType<typeof submitGarageShareRequest>>;

function revalidationFilterKey(url: URL) {
  const params = new URLSearchParams(url.searchParams);
  params.delete('day');
  return params.toString();
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const data = await loadDaysIndex(user, new URL(request.url));

  return Response.json(data, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get('intent');
  let result: AvailableDaysActionResult;

  if (intent === 'saveDaysFilters') {
    result = await submitSaveDaysFilters(formData, user.id);
  } else if (intent === 'clearSavedDaysFilters') {
    result = await submitClearSavedDaysFilters(user.id);
  } else if (intent === 'useSharedStay') {
    result = await submitSharedStaySelection(formData, user);
  } else if (intent === 'saveSharedDayPlan') {
    result = await submitSharedDayPlan(formData, user);
  } else if (intent === 'requestGarageShare') {
    result = await submitGarageShareRequest(formData, user);
  } else if (intent === 'addRaceSeries') {
    result = await submitBulkRaceSeriesBooking(formData, user);
  } else {
    result = await submitCreateBooking(formData, user);
  }

  if (result.ok) {
    if (intent === 'useSharedStay') {
      await recordAppEventSafely({
        category: 'audit',
        action: 'booking.sharedStay.selected',
        message: 'Shared stay selected from available days.',
        actor: { userId: user.id, name: user.name },
        subject: {
          type: 'day',
          id: formData.get('dayId')?.toString(),
        },
        metadata: {
          accommodationName: formData.get('accommodationName')?.toString(),
        },
      });
    } else if (intent === 'saveSharedDayPlan') {
      const savedPlan = 'plan' in result ? result.plan : null;
      await recordAppEventSafely({
        category: 'audit',
        action: savedPlan ? 'dayPlan.saved' : 'dayPlan.deleted',
        message: savedPlan
          ? 'Shared day plan saved.'
          : 'Shared day plan deleted.',
        actor: { userId: user.id, name: user.name },
        subject: {
          type: 'day',
          id: formData.get('dayId')?.toString(),
        },
      });
    } else if (intent === 'requestGarageShare') {
      await recordAppEventSafely({
        category: 'audit',
        action: 'garageShare.requested',
        message: 'Garage share request sent.',
        actor: { userId: user.id, name: user.name },
        subject: {
          type: 'day',
          id: formData.get('dayId')?.toString(),
        },
        metadata: {
          garageOwnerUserId: formData.get('garageOwnerUserId')?.toString(),
        },
      });
    } else if (intent === 'addRaceSeries') {
      const seriesResult =
        'seriesName' in result
          ? result
          : {
              seriesName: 'Race series',
              totalCount: undefined,
              addedCount: undefined,
              existingCount: undefined,
            };
      await recordAppEventSafely({
        category: 'audit',
        action: 'booking.raceSeries.added',
        message: `${seriesResult.seriesName} added from available days.`,
        actor: { userId: user.id, name: user.name },
        subject: {
          type: 'day',
          id: formData.get('dayId')?.toString(),
        },
        metadata: {
          totalCount: seriesResult.totalCount,
          addedCount: seriesResult.addedCount,
          existingCount: seriesResult.existingCount,
        },
      });
    } else if (
      intent !== 'saveDaysFilters' &&
      intent !== 'clearSavedDaysFilters'
    ) {
      await recordAppEventSafely({
        category: 'audit',
        action: 'booking.created',
        message: 'Booking created from available days.',
        actor: { userId: user.id, name: user.name },
        subject: {
          type: 'day',
          id: formData.get('dayId')?.toString(),
        },
        metadata: {
          status: formData.get('status')?.toString(),
        },
      });
    }
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (
    currentUrl.pathname === nextUrl.pathname &&
    revalidationFilterKey(currentUrl) === revalidationFilterKey(nextUrl) &&
    currentUrl.searchParams.get('day') !== nextUrl.searchParams.get('day')
  ) {
    return false;
  }

  return defaultShouldRevalidate;
}

export default function AvailableDaysRoute() {
  return (
    <AvailableDaysPage data={useLoaderData<typeof loader>() as DaysIndexData} />
  );
}
