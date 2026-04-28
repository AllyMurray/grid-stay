import { useLoaderData } from 'react-router';
import {
  loadAdminDayMergesReport,
  submitAdminDayMergeAction,
} from '~/lib/admin/day-merges.server';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import {
  AdminDayMergesPage,
  type AdminDayMergesPageProps,
} from '~/pages/dashboard/admin-day-merges';
import type { Route } from './+types/admin.day-merges';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const report = await loadAdminDayMergesReport();

  return Response.json(report satisfies AdminDayMergesPageProps, {
    headers,
  });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString() ?? 'unknown';
  const result = await submitAdminDayMergeAction(formData, user);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: `admin.dayMerge.${intent}`,
      message: result.message,
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'dayMerge',
        id: formData.get('sourceDayId')?.toString(),
      },
      metadata: {
        targetDayId: formData.get('targetDayId')?.toString(),
        movedBookingCount: result.movedBookingCount,
        mergedBookingCount: result.mergedBookingCount,
        movedPlan: result.movedPlan,
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function AdminDayMergesRoute() {
  const data = useLoaderData<typeof loader>() as AdminDayMergesPageProps;
  return <AdminDayMergesPage {...data} />;
}
