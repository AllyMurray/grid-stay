import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { loadAdminFeedStatusReport } from '~/lib/days/admin-feed.server';
import { AdminFeedPage, type AdminFeedPageProps } from '~/pages/dashboard/admin-feed';
import type { Route } from './+types/admin.feed';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const report = await loadAdminFeedStatusReport();

  return Response.json(report satisfies AdminFeedPageProps, {
    headers,
  });
}

export default function AdminFeedRoute() {
  const data = useLoaderData<typeof loader>() as AdminFeedPageProps;
  return <AdminFeedPage {...data} />;
}
