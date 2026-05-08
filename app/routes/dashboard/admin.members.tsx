import { useLoaderData } from 'react-router';
import { requireAdmin } from '~/lib/auth/helpers.server';
import {
  listPendingMemberInvites,
  submitMemberInviteAction,
} from '~/lib/auth/member-invites.server';
import {
  listMemberJoinLinks,
  submitMemberJoinLinkAction,
} from '~/lib/auth/member-join-links.server';
import { listAdminSiteMembers } from '~/lib/auth/members.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { AdminMembersPage, type AdminMembersPageProps } from '~/pages/dashboard/admin-members';
import type { Route } from './+types/admin.members';

export async function loader({ request }: Route.LoaderArgs) {
  const { headers } = await requireAdmin(request);
  const [members, joinLinks, pendingInvites] = await Promise.all([
    listAdminSiteMembers(),
    listMemberJoinLinks(),
    listPendingMemberInvites(),
  ]);

  return Response.json({ members, joinLinks, pendingInvites } satisfies AdminMembersPageProps, {
    headers,
  });
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get('intent')?.toString() ?? 'createInvite';

  if (intent === 'createInvite' || intent === 'revokeInvite') {
    const result = await submitMemberInviteAction(formData, user, undefined, { request });

    if (result.ok) {
      await recordAppEventSafely({
        category: 'audit',
        action: `member.invite.${intent}`,
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

  const result = await submitMemberJoinLinkAction({
    formData,
    user,
    request,
  });

  if (result.ok) {
    await recordAppEventSafely({
      category: 'audit',
      action: `memberJoinLink.${result.intent}`,
      message: result.message,
      actor: { userId: user.id, name: user.name },
      subject: {
        type: 'memberJoinLink',
        id: result.link.tokenHash,
      },
      metadata: {
        mode: result.link.mode,
        maxUses: result.link.maxUses,
        state: result.link.state,
        acceptedCount: result.link.acceptedCount,
      },
    });
  }

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function AdminMembersRoute() {
  const data = useLoaderData<typeof loader>() as AdminMembersPageProps;
  return <AdminMembersPage {...data} />;
}
