import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import { listSiteMembers } from '~/lib/auth/members.server';
import { MembersPage, type MembersPageProps } from '~/pages/dashboard/members';
import type { Route } from './+types/members';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  const members = await listSiteMembers();

  return Response.json({ members }, { headers });
}

export default function MembersRoute() {
  const data = useLoaderData<typeof loader>() as MembersPageProps;
  return <MembersPage members={data.members} />;
}
