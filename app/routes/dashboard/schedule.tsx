import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  buildCalendarFeedUrl,
  ensureCalendarFeedForUser,
  getActiveCalendarFeedForUser,
  getCalendarFeedOptions,
  parseCalendarFeedOptionsFromFormData,
  regenerateCalendarFeedForUser,
  saveCalendarFeedOptionsForUser,
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
      calendarFeedOptions: getCalendarFeedOptions(calendarFeed),
    },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get('intent');
  const options = parseCalendarFeedOptionsFromFormData(formData);
  const feed =
    intent === 'regenerateCalendarFeed'
      ? await regenerateCalendarFeedForUser(
          user.id,
          undefined,
          undefined,
          options,
        )
      : intent === 'saveCalendarFeedOptions'
        ? await saveCalendarFeedOptionsForUser(user.id, options)
        : await ensureCalendarFeedForUser(
            user.id,
            undefined,
            undefined,
            options,
          );

  return Response.json(
    {
      ok: true,
      feedUrl: buildCalendarFeedUrl(request, feed.token),
      options: getCalendarFeedOptions(feed),
    },
    { headers },
  );
}

export default function BookingScheduleRoute() {
  const data = useLoaderData<typeof loader>() as {
    bookings: BookingRecord[];
    calendarFeedUrl: string | null;
    calendarFeedOptions: ReturnType<typeof getCalendarFeedOptions>;
  };
  return (
    <BookingSchedulePage
      bookings={data.bookings}
      calendarFeedUrl={data.calendarFeedUrl}
      calendarFeedOptions={data.calendarFeedOptions}
    />
  );
}
