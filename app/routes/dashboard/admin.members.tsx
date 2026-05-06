import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import { listAdminSiteMembers } from '~/lib/auth/members.server';
import { AdminMembersPage, type AdminMembersPageProps } from '~/pages/dashboard/admin-members';
import type { Route } from './+types/admin.members';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const members = await listAdminSiteMembers();

  return Response.json({ members } satisfies AdminMembersPageProps, {
    headers,
  });
}

export default function AdminMembersRoute() {
  const data = useLoaderData<typeof loader>() as AdminMembersPageProps;
  return <AdminMembersPage {...data} />;
}
