import { redirect } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  buildCalendarFeedUrl,
  ensureCalendarFeedForUser,
  getCalendarFeedOptions,
  parseCalendarFeedOptionsFromFormData,
  regenerateCalendarFeedForUser,
  saveCalendarFeedOptionsForUser,
} from '~/lib/calendar/feed.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import type { Route } from './+types/schedule';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  const url = new URL(request.url);
  const view = url.searchParams.get('view');

  return redirect(
    view === 'calendar'
      ? '/dashboard/bookings?view=calendar'
      : '/dashboard/bookings',
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
  return null;
}
