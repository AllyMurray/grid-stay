import { useLoaderData } from 'react-router';
import { DashboardShell } from '~/components/layout/dashboard-shell';
import { requireUser } from '~/lib/auth/helpers.server';
import type { User } from '~/lib/auth/schemas';
import type { Route } from './+types/_dashboard';

interface LoaderData {
  user: User;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);

  return Response.json({ user }, { headers });
}

export default function DashboardLayoutRoute() {
  const { user } = useLoaderData<LoaderData>();

  return <DashboardShell user={user} />;
}
