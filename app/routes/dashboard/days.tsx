import { type ShouldRevalidateFunctionArgs, useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { submitCreateBooking } from '~/lib/bookings/actions.server';
import type { DaysIndexData } from '~/lib/days/dashboard-feed.server';
import { loadDaysIndex } from '~/lib/days/dashboard-feed.server';
import { AvailableDaysPage } from '~/pages/dashboard/days';
import type { Route } from './+types/days';

function revalidationFilterKey(url: URL) {
  const params = new URLSearchParams(url.searchParams);
  params.delete('day');
  return params.toString();
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const data = await loadDaysIndex(user.id, new URL(request.url));

  return Response.json(data, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const result = await submitCreateBooking(await request.formData(), user);

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
