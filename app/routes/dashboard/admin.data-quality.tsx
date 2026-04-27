import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import {
  loadDaysDataQualityReport,
  submitDataQualityIssueStateAction,
} from '~/lib/days/data-quality.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import {
  AdminDataQualityPage,
  type AdminDataQualityPageProps,
} from '~/pages/dashboard/admin-data-quality';
import type { Route } from './+types/admin.data-quality';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const report = await loadDaysDataQualityReport();

  return Response.json(report satisfies AdminDataQualityPageProps, {
    headers,
  });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireAdmin(request);
  const formData = await request.formData();
  const result = await submitDataQualityIssueStateAction(formData, user);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: `dataQualityIssue.${result.status}`,
      message: result.message,
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'dataQualityIssue',
        id: result.issueId,
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function AdminDataQualityRoute() {
  const data = useLoaderData<typeof loader>() as AdminDataQualityPageProps;
  return <AdminDataQualityPage {...data} />;
}
