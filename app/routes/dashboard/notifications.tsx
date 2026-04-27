import { redirect, useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  listUserDayNotifications,
  markAllDayNotificationsRead,
} from '~/lib/db/services/day-notification.server';
import {
  NotificationsPage,
  type NotificationsPageProps,
} from '~/pages/dashboard/notifications';
import type { Route } from './+types/notifications';

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const notifications = await listUserDayNotifications(user.id);

  return Response.json(
    {
      notifications,
    } satisfies NotificationsPageProps,
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();

  if (formData.get('intent') === 'markAllRead') {
    await markAllDayNotificationsRead(user.id);
  }

  return redirect('/dashboard/notifications', { headers });
}

export default function NotificationsRoute() {
  const data = useLoaderData<typeof loader>() as NotificationsPageProps;
  return <NotificationsPage {...data} />;
}
