import { requireUser } from '~/lib/auth/helpers.server';
import {
  buildCalendarFeedUrl,
  ensureCalendarFeedForUser,
  regenerateCalendarFeedForUser,
} from '~/lib/calendar/feed.server';
import type { Route } from './+types/api.calendar-feed';

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
