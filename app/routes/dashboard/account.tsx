import { useLoaderData } from 'react-router';
import { cloneHeadersPreservingSetCookie } from '~/lib/auth/cookies.server';
import { requireUser } from '~/lib/auth/helpers.server';
import { getPasswordAccountStatus } from '~/lib/auth/password-auth.server';
import type { User } from '~/lib/auth/schemas';
import { submitMemberPaymentPreference } from '~/lib/cost-splitting/actions.server';
import { getMemberPaymentPreference } from '~/lib/db/services/member-payment-preference.server';
import { AccountPage } from '~/pages/dashboard/account';
import type { Route } from './+types/account';

interface LoaderData {
  hasPassword: boolean;
  paymentPreference: {
    label: string;
    url: string;
  } | null;
  user: User;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const [passwordStatus, paymentPreference] = await Promise.all([
    getPasswordAccountStatus(request),
    getMemberPaymentPreference(user.id),
  ]);
  const responseHeaders = cloneHeadersPreservingSetCookie(headers);

  for (const cookie of passwordStatus.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  return Response.json(
    {
      hasPassword: passwordStatus.hasPassword,
      paymentPreference: paymentPreference
        ? {
            label: paymentPreference.label,
            url: paymentPreference.url,
          }
        : null,
      user,
    } satisfies LoaderData,
    { headers: responseHeaders },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { user, headers } = await requireUser(request);
  const formData = await request.formData();
  const result = await submitMemberPaymentPreference(formData, user);

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function AccountRoute() {
  const data = useLoaderData<typeof loader>() as LoaderData;

  return <AccountPage {...data} />;
}
