import { useLoaderData } from 'react-router';
import { cloneHeadersPreservingSetCookie } from '~/lib/auth/cookies.server';
import { requireUser } from '~/lib/auth/helpers.server';
import { getPasswordAccountStatus } from '~/lib/auth/password-auth.server';
import type { User } from '~/lib/auth/schemas';
import { AccountPage } from '~/pages/dashboard/account';
import type { Route } from './+types/account';

interface LoaderData {
  hasPassword: boolean;
  user: User;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const passwordStatus = await getPasswordAccountStatus(request);
  const responseHeaders = cloneHeadersPreservingSetCookie(headers);

  for (const cookie of passwordStatus.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  return Response.json(
    {
      hasPassword: passwordStatus.hasPassword,
      user,
    } satisfies LoaderData,
    { headers: responseHeaders },
  );
}

export default function AccountRoute() {
  const data = useLoaderData<typeof loader>() as LoaderData;

  return <AccountPage {...data} />;
}
