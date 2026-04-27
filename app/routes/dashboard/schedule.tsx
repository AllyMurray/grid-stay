import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  buildCalendarFeedUrl,
  ensureCalendarFeedForUser,
  getActiveCalendarFeedForUser,
  regenerateCalendarFeedForUser,
} from '~/lib/calendar/feed.server';
import type { BookingRecord } from '~/lib/db/entities/booking.server';
import { listMyBookings } from '~/lib/db/services/booking.server';
import { BookingSchedulePage } from '~/pages/dashboard/schedule';
import type { Route } from './+types/schedule';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const [bookings, calendarFeed] = await Promise.all([
    listMyBookings(user.id),
    getActiveCalendarFeedForUser(user.id),
  ]);

  return Response.json(
    {
      bookings,
      calendarFeedUrl: calendarFeed
        ? buildCalendarFeedUrl(request, calendarFeed.token)
        : null,
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get('intent');
  const feed =
    intent === 'regenerateCalendarFeed'
      ? await regenerateCalendarFeedForUser(user.id)
      : await ensureCalendarFeedForUser(user.id);

  return Response.json(
    {
      ok: true,
      feedUrl: buildCalendarFeedUrl(request, feed.token),
    },
    { headers },
  );
}

export default function BookingScheduleRoute() {
  const data = useLoaderData<typeof loader>() as {
    bookings: BookingRecord[];
    calendarFeedUrl: string | null;
  };
  return (
    <BookingSchedulePage
      bookings={data.bookings}
      calendarFeedUrl={data.calendarFeedUrl}
    />
  );
}
