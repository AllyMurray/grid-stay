import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import {
  listRecentEventRequests,
  submitAdminEventRequestAction,
} from '~/lib/db/services/event-request.server';
import {
  AdminEventRequestsPage,
  type AdminEventRequestsPageProps,
} from '~/pages/dashboard/admin-event-requests';
import type { Route } from './+types/admin.event-requests';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const eventRequests = await listRecentEventRequests();

  return Response.json(
    {
      eventRequests,
    } satisfies AdminEventRequestsPageProps,
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireAdmin(request);
  const formData = await request.formData();
  const result = await submitAdminEventRequestAction(formData, user);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action:
        result.intent === 'approveEventRequest'
          ? 'eventRequest.approved'
          : 'eventRequest.rejected',
      message: result.message,
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'eventRequest',
        id: result.request.requestId,
      },
      metadata:
        result.intent === 'approveEventRequest'
          ? {
              approvedDayId: result.manualDay.dayId,
              type: result.manualDay.type,
            }
          : undefined,
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function AdminEventRequestsRoute() {
  const data = useLoaderData<typeof loader>() as AdminEventRequestsPageProps;
  return <AdminEventRequestsPage {...data} />;
}
