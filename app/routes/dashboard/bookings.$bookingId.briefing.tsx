import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { EVENT_BRIEFING_FEATURE } from '~/lib/beta-features/config';
import { isBetaFeatureEnabled } from '~/lib/beta-features/preferences.server';
import { loadEventBriefing, type EventBriefingData } from '~/lib/bookings/event-briefing.server';
import { EventBriefingPage } from '~/pages/dashboard/event-briefing';
import type { Route } from './+types/bookings.$bookingId.briefing';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  if (!(await isBetaFeatureEnabled(user.id, EVENT_BRIEFING_FEATURE))) {
    throw new Response('Briefing not found', { status: 404, headers });
  }

  const bookingId = params.bookingId ?? '';
  const data = await loadEventBriefing(bookingId, user);

  return Response.json(data, { headers });
}

export default function EventBriefingRoute() {
  return <EventBriefingPage data={useLoaderData<typeof loader>() as EventBriefingData} />;
}
