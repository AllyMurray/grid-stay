import { useLoaderData } from 'react-router';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  listPendingMemberInvites,
  submitMemberInvite,
} from '~/lib/auth/member-invites.server';
import { listSiteMembers } from '~/lib/auth/members.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { MembersPage, type MembersPageProps } from '~/pages/dashboard/members';
import type { Route } from './+types/members';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireUser(request);
  const [members, pendingInvites] = await Promise.all([
    listSiteMembers(),
    listPendingMemberInvites(),
  ]);

  return Response.json({ members, pendingInvites }, { headers });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const result = await submitMemberInvite(formData, user);

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: 'member.invite.submitted',
      message: result.message,
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'memberInvite',
        id: result.invite.inviteEmail,
      },
      metadata: {
        inviteStatus: result.invite.status,
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function MembersRoute() {
  const data = useLoaderData<typeof loader>() as MembersPageProps;
  return <MembersPage {...data} />;
}
