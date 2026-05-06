import { requireUser } from '~/lib/auth/helpers.server';
import { countUnreadDayNotifications } from '~/lib/db/services/day-notification.server';
import { countPendingIncomingGarageShareRequests } from '~/lib/db/services/garage-sharing.server';
import { countNewWhatsNewEntries } from '~/lib/db/services/whats-new-view.server';
import type { Route } from './+types/api.dashboard.badge-counts';

export interface DashboardBadgeCountsData {
  unreadNotificationCount: number;
  newWhatsNewCount: number;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const [unreadDayCount, pendingGarageShareCount, newWhatsNewCount] = await Promise.all([
    countUnreadDayNotifications(user.id),
    countPendingIncomingGarageShareRequests(user.id),
    countNewWhatsNewEntries(user.id),
  ]);

  return Response.json(
    {
      unreadNotificationCount: unreadDayCount + pendingGarageShareCount,
      newWhatsNewCount,
    } satisfies DashboardBadgeCountsData,
    { headers },
  );
}

export default function DashboardBadgeCountsRoute() {
  return null;
}
