import { redirect, useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  listUserDayNotifications,
  markAllDayNotificationsRead,
} from '~/lib/db/services/day-notification.server';
import { listPendingIncomingGarageShareRequests } from '~/lib/db/services/garage-sharing.server';
import { submitGarageShareDecision } from '~/lib/garage-sharing/actions.server';
import {
  NotificationsPage,
  type NotificationsPageProps,
} from '~/pages/dashboard/notifications';
import type { Route } from './+types/notifications';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const [notifications, garageShareRequests] = await Promise.all([
    listUserDayNotifications(user.id),
    listPendingIncomingGarageShareRequests(user.id),
  ]);

  return Response.json(
    {
      notifications,
      garageShareRequests,
    } satisfies NotificationsPageProps,
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();

  if (formData.get('intent') === 'markAllRead') {
    await markAllDayNotificationsRead(user.id);
  } else if (formData.get('intent') === 'updateGarageShareRequest') {
    await submitGarageShareDecision(formData, user);
  }

  return redirect('/dashboard/notifications', { headers });
}

export default function NotificationsRoute() {
  const data = useLoaderData<typeof loader>() as NotificationsPageProps;
  return <NotificationsPage {...data} />;
}
