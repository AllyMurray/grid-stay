import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { getAvailableDaysSnapshot } from '~/lib/db/services/available-days-cache.server';
import {
  AdminFeedPage,
  type AdminFeedPageProps,
} from '~/pages/dashboard/admin-feed';
import type { Route } from './+types/admin.feed';

const MISSING_SNAPSHOT_ERROR = {
  source: 'cache',
  message:
    'Available days have not been refreshed yet. Please try again after the next scheduled sync.',
};

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const snapshot = await getAvailableDaysSnapshot();

  return Response.json(
    {
      sourceErrors: snapshot?.errors ?? [MISSING_SNAPSHOT_ERROR],
      refreshedAt: snapshot?.refreshedAt ?? '',
      dayCount: snapshot?.days.length ?? 0,
    } satisfies AdminFeedPageProps,
    {
      headers,
    },
  );
}

export default function AdminFeedRoute() {
  const data = useLoaderData<typeof loader>() as AdminFeedPageProps;
  return <AdminFeedPage {...data} />;
}
