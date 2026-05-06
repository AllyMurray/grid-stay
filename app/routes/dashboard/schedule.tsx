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
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
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
      calendarFeedExists: Boolean(calendarFeed),
      calendarFeedUrl: calendarFeed?.token
        ? buildCalendarFeedUrl(request, calendarFeed.token)
        : null,
      calendarFeedTokenHint: calendarFeed?.tokenHint ?? null,
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
      ? await regenerateCalendarFeedForUser(user.id, undefined, undefined, options)
      : intent === 'saveCalendarFeedOptions'
        ? await saveCalendarFeedOptionsForUser(user.id, options)
        : await ensureCalendarFeedForUser(user.id, undefined, undefined, options);

  await recordAppEventSafely({
    category: 'audit',
    action:
      intent === 'regenerateCalendarFeed'
        ? 'calendarFeed.regenerated'
        : intent === 'saveCalendarFeedOptions'
          ? 'calendarFeed.optionsSaved'
          : 'calendarFeed.created',
    message:
      intent === 'regenerateCalendarFeed'
        ? 'Calendar feed link regenerated.'
        : intent === 'saveCalendarFeedOptions'
          ? 'Calendar feed options saved.'
          : 'Calendar feed created.',
    actor: { userId: user.id, name: user.name },
    subject: {
      type: 'calendarFeed',
      id: feed.tokenHash,
    },
    metadata: {
      includeMaybe: options.includeMaybe,
      includeStay: options.includeStay,
    },
  });

  return Response.json(
    {
      ok: true,
      feedExists: true,
      feedUrl: feed.token ? buildCalendarFeedUrl(request, feed.token) : null,
      tokenHint: feed.tokenHint ?? null,
      options: getCalendarFeedOptions(feed),
    },
    { headers },
  );
}

export default function BookingScheduleRoute() {
  const data = useLoaderData<typeof loader>() as {
    bookings: BookingRecord[];
    calendarFeedExists: boolean;
    calendarFeedUrl: string | null;
    calendarFeedTokenHint: string | null;
    calendarFeedOptions: ReturnType<typeof getCalendarFeedOptions>;
  };
  return (
    <BookingSchedulePage
      bookings={data.bookings}
      calendarFeedExists={data.calendarFeedExists}
      calendarFeedUrl={data.calendarFeedUrl}
      calendarFeedTokenHint={data.calendarFeedTokenHint}
      calendarFeedOptions={data.calendarFeedOptions}
    />
  );
}
