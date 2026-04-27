import { useLoaderData } from 'react-router';
import {
  buildAdminSeriesOptions,
  getAdminMemberProfile,
  submitAdminMemberSeriesAction,
} from '~/lib/admin/member-management.server';
import { requireAdmin } from '~/lib/auth/helpers.server';
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
  const seriesOptions = buildAdminSeriesOptions([
    ...(snapshot?.days ?? []),
    ...manualDays,
  ]);

  return Response.json(
    { profile, seriesOptions } satisfies AdminMemberDetailPageProps,
    { headers },
  );
}

export async function action({ request, params }: Route.ActionArgs) {
  const { headers } = await requireAdmin(request);
  const formData = await request.formData();
  const result = await submitAdminMemberSeriesAction(formData, params.memberId);

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function AdminMemberDetailRoute() {
  const data = useLoaderData<typeof loader>() as AdminMemberDetailPageProps;
  return <AdminMemberDetailPage {...data} />;
}
