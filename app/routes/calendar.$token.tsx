import {
  getActiveCalendarFeedByToken,
  stripCalendarFeedTokenSuffix,
} from '~/lib/calendar/feed.server';
import { buildCalendarIcs } from '~/lib/calendar/ics.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import type { Route } from './+types/calendar.$token';

export async function loader({ params }: Route.LoaderArgs) {
  const token = stripCalendarFeedTokenSuffix(params.token ?? '');
  const feed = token ? await getActiveCalendarFeedByToken(token) : null;

  if (!feed) {
    throw new Response('Calendar feed not found', { status: 404 });
  }

  const bookings = await listMyBookings(feed.userId);
  const calendar = buildCalendarIcs(bookings);

  return new Response(calendar, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': 'inline; filename="grid-stay.ics"',
    },
  });
}
