import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { loadDaysDataQualityReport } from '~/lib/days/data-quality.server';
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

export default function AdminDataQualityRoute() {
  const data = useLoaderData<typeof loader>() as AdminDataQualityPageProps;
  return <AdminDataQualityPage {...data} />;
}
