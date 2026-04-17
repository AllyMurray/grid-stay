import { requireUser } from '~/lib/auth/helpers.server';
import { loadDaysFeed } from '~/lib/days/dashboard-feed.server';
import type { Route } from './+types/api.dashboard.days-feed';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  const data = await loadDaysFeed(new URL(request.url));

  return Response.json(data, { headers });
}

export default function DashboardDaysFeedRoute() {
  return null;
}
