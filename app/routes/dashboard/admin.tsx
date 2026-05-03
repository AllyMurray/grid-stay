import { requireAdmin } from '~/lib/auth/helpers.server';
import { AdminDashboardPage } from '~/pages/dashboard/admin-dashboard';
import type { Route } from './+types/admin';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  return Response.json({}, { headers });
}

export default function AdminDashboardRoute() {
  return <AdminDashboardPage />;
}
