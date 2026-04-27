import { useLoaderData } from 'react-router';
import { DashboardShell } from '~/components/layout/dashboard-shell';
import { requireUser } from '~/lib/auth/helpers.server';
import type { User } from '~/lib/auth/schemas';
import { countUnreadDayNotifications } from '~/lib/db/services/day-notification.server';
import type { Route } from './+types/_dashboard';

interface LoaderData {
  user: User;
  unreadNotificationCount: number;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const unreadNotificationCount = await countUnreadDayNotifications(user.id);

  return Response.json({ user, unreadNotificationCount }, { headers });
}

export default function DashboardLayoutRoute() {
  const { user, unreadNotificationCount } = useLoaderData<LoaderData>();

  return (
    <DashboardShell
      user={user}
      unreadNotificationCount={unreadNotificationCount}
    />
  );
}
