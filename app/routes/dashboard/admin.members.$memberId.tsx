import { useLoaderData } from 'react-router';
import {
  buildAdminSeriesOptions,
  getAdminMemberProfile,
  submitAdminMemberAction,
} from '~/lib/admin/member-management.server';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import { listManualDays } from '~/lib/db/services/manual-day.server';
import {
  AdminMemberDetailPage,
  type AdminMemberDetailPageProps,
} from '~/pages/dashboard/admin-member-detail';
import type { Route } from './+types/admin.members.$memberId';

export async function loader({ request, params }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const memberId = params.memberId;
  const [profile, snapshot, manualDays] = await Promise.all([
    getAdminMemberProfile(memberId),
    getAvailableDaysSnapshot(),
    listManualDays(),
  ]);
  const seriesOptions = buildAdminSeriesOptions([...(snapshot?.days ?? []), ...manualDays]);

  return Response.json({ profile, seriesOptions } satisfies AdminMemberDetailPageProps, {
    headers,
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user, headers } = await requireAdmin(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? 'unknown');
  const result = await submitAdminMemberAction(formData, params.memberId, user);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: `admin.member.${intent}`,
      message: result.message,
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'member',
        id: params.memberId,
      },
      metadata: {
        seriesKey: formData.get('seriesKey')?.toString(),
        addedCount: result.addedCount,
        existingCount: result.existingCount,
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function AdminMemberDetailRoute() {
  const data = useLoaderData<typeof loader>() as AdminMemberDetailPageProps;
  return <AdminMemberDetailPage {...data} />;
}
