import { useLoaderData } from 'react-router';
import { DashboardShell } from '~/components/layout/dashboard-shell';
import { requireUser } from '~/lib/auth/helpers.server';
import type { User } from '~/lib/auth/schemas';
import { countUnreadDayNotifications } from '~/lib/db/services/day-notification.server';
import { countPendingIncomingGarageShareRequests } from '~/lib/db/services/garage-sharing.server';
import { countNewWhatsNewEntries } from '~/lib/db/services/whats-new-view.server';
import type { Route } from './+types/_dashboard';

interface LoaderData {
  user: User;
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
  const unreadNotificationCount = unreadDayCount + pendingGarageShareCount;

  return Response.json({ user, unreadNotificationCount, newWhatsNewCount }, { headers });
}

export default function DashboardLayoutRoute() {
  const { user, unreadNotificationCount, newWhatsNewCount = 0 } = useLoaderData<LoaderData>();

  return (
    <DashboardShell
      user={user}
      unreadNotificationCount={unreadNotificationCount}
      newWhatsNewCount={newWhatsNewCount}
    />
  );
}
