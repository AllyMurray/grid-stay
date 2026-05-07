import { useLoaderData } from 'react-router';
import { loadEventBriefing, type EventBriefingData } from '~/lib/bookings/event-briefing.server';
import { requireUser } from '~/lib/auth/helpers.server';
import { EventBriefingPage } from '~/pages/dashboard/event-briefing';
import type { Route } from './+types/bookings.$bookingId.briefing';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const bookingId = params.bookingId ?? '';
  const data = await loadEventBriefing(bookingId, user);

  return Response.json(data, { headers });
}

export default function EventBriefingRoute() {
  return <EventBriefingPage data={useLoaderData<typeof loader>() as EventBriefingData} />;
}
