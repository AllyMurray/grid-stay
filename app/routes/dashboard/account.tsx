import { useActionData, useLoaderData } from 'react-router';
import { cloneHeadersPreservingSetCookie } from '~/lib/auth/cookies.server';
import { requireUser } from '~/lib/auth/helpers.server';
import {
  getPasswordAccountStatus,
  submitSetPassword,
} from '~/lib/auth/password-auth.server';
import type { AccountPasswordActionData } from '~/lib/auth/password-auth.shared';
import { isPasswordAuthEnabled } from '~/lib/auth/password-auth-availability.server';
import type { User } from '~/lib/auth/schemas';
import { AccountPage } from '~/pages/dashboard/account';
import type { Route } from './+types/account';

interface LoaderData {
  hasPassword: boolean;
  passwordAuthAvailable: boolean;
  user: User;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const passwordAuthAvailable = isPasswordAuthEnabled();
  const passwordStatus = await getPasswordAccountStatus(request);
  const responseHeaders = cloneHeadersPreservingSetCookie(headers);

  for (const cookie of passwordStatus.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  return Response.json(
    {
      hasPassword: passwordStatus.hasPassword,
      passwordAuthAvailable,
      user,
    } satisfies LoaderData,
    { headers: responseHeaders },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { headers } = await requireUser(request);
  const formData = await request.formData();

  return submitSetPassword(request, formData, headers);
}

export default function AccountRoute() {
  const data = useLoaderData<typeof loader>() as LoaderData;
  const actionData = useActionData<typeof action>() as
    | AccountPasswordActionData
    | undefined;

  return <AccountPage {...data} actionData={actionData} />;
}
