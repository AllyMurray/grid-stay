import { useLoaderData } from 'react-router';
import { loadAdminOperationsReport } from '~/lib/admin/operations.server';
import { requireAdmin } from '~/lib/auth/helpers.server';
import {
  AdminOperationsPage,
  type AdminOperationsPageProps,
} from '~/pages/dashboard/admin-operations';
import type { Route } from './+types/admin.operations';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const report = await loadAdminOperationsReport();

  return Response.json(report satisfies AdminOperationsPageProps, {
    headers,
  });
}

export default function AdminOperationsRoute() {
  const data = useLoaderData<typeof loader>() as AdminOperationsPageProps;
  return <AdminOperationsPage {...data} />;
}
