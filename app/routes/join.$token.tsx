import { redirect, useLoaderData } from 'react-router';
import { cloneHeadersPreservingSetCookie } from '~/lib/auth/cookies.server';
import { getUser } from '~/lib/auth/helpers.server';
import {
  createAcceptedMemberInviteForUser,
  ensureUserMemberAccess,
} from '~/lib/auth/member-invites.server';
import {
  acceptMemberJoinLink,
  createClearMemberJoinLinkCookieHeader,
  createMemberJoinLinkCookieHeader,
  getMemberJoinLinkByToken,
} from '~/lib/auth/member-join-links.server';
import { recordAppEventSafely } from '~/lib/db/services/app-event.server';
import { type JoinLinkFailureReason, JoinLinkPage, type JoinLinkPageProps } from '~/pages/join';
import type { Route } from './+types/join.$token';

function failureStatus(reason: JoinLinkFailureReason) {
  return reason === 'not_found' ? 404 : 410;
}

function loginRedirectForJoinToken(token: string) {
  return `/auth/login?redirectTo=${encodeURIComponent(`/join/${token}`)}`;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const token = params.token ?? '';
  const lookup = await getMemberJoinLinkByToken({ token });

  if (!lookup.ok) {
    const headers = new Headers();
    headers.append('set-cookie', createClearMemberJoinLinkCookieHeader({ request }));

    return Response.json({ reason: lookup.reason } satisfies JoinLinkPageProps, {
      headers,
      status: failureStatus(lookup.reason),
    });
  }

  const authResult = await getUser(request);
  if (!authResult) {
    const headers = new Headers();
    headers.append(
      'set-cookie',
      createMemberJoinLinkCookieHeader({
        request,
        token,
        expiresAt: lookup.link.expiresAt,
      }),
    );

    throw redirect(loginRedirectForJoinToken(token), { headers });
  }

  const headers = cloneHeadersPreservingSetCookie(authResult.headers);

  if (await ensureUserMemberAccess(authResult.user)) {
    headers.append('set-cookie', createClearMemberJoinLinkCookieHeader({ request }));
    throw redirect('/dashboard/days', { headers });
  }

  const accepted = await acceptMemberJoinLink({
    token,
    user: authResult.user,
  });
  if (!accepted.ok) {
    headers.append('set-cookie', createClearMemberJoinLinkCookieHeader({ request }));

    return Response.json({ reason: accepted.reason } satisfies JoinLinkPageProps, {
      headers,
      status: failureStatus(accepted.reason),
    });
  }

  await createAcceptedMemberInviteForUser({
    user: authResult.user,
    invitedBy: {
      id: accepted.link.createdByUserId,
      name: accepted.link.createdByName,
    },
  });

  await recordAppEventSafely({
    category: 'audit',
    action: 'memberJoinLink.accepted',
    message: 'Member join link accepted.',
    actor: { userId: authResult.user.id, name: authResult.user.name },
    subject: {
      type: 'memberJoinLink',
      id: accepted.link.tokenHash,
    },
    metadata: {
      mode: accepted.link.mode,
      acceptedCount: accepted.link.acceptedCount,
    },
  });

  headers.append('set-cookie', createClearMemberJoinLinkCookieHeader({ request }));
  throw redirect('/dashboard/days', { headers });
}

export default function JoinRoute() {
  const data = useLoaderData<typeof loader>() as JoinLinkPageProps;
  return <JoinLinkPage {...data} />;
}
