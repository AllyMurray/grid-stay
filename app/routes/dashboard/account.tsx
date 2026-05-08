import { useLoaderData } from 'react-router';
import { cloneHeadersPreservingSetCookie } from '~/lib/auth/cookies.server';
import { requireUser } from '~/lib/auth/helpers.server';
import { getPasswordAccountStatus } from '~/lib/auth/password-auth.server';
import type { User } from '~/lib/auth/schemas';
import {
  getMemberBetaFeatureSettings,
  submitMemberBetaFeaturePreference,
} from '~/lib/beta-features/preferences.server';
import type { BetaFeatureSettings } from '~/lib/beta-features/config';
import { submitMemberPaymentPreference } from '~/lib/cost-splitting/actions.server';
import { getMemberPaymentPreference } from '~/lib/db/services/member-payment-preference.server';
import { AccountPage } from '~/pages/dashboard/account';
import type { Route } from './+types/account';

interface LoaderData {
  betaFeatures: BetaFeatureSettings;
  hasPassword: boolean;
  paymentPreference: {
    label: string;
    url: string;
  } | null;
  user: User;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { user, headers } = await requireUser(request);
  const [passwordStatus, paymentPreference, betaFeatures] = await Promise.all([
    getPasswordAccountStatus(request),
    getMemberPaymentPreference(user.id),
    getMemberBetaFeatureSettings(user.id),
  ]);
  const responseHeaders = cloneHeadersPreservingSetCookie(headers);

  for (const cookie of passwordStatus.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  return Response.json(
    {
      betaFeatures,
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
  const intent = formData.get('intent');
  const result =
    intent === 'updateBetaFeature'
      ? await submitMemberBetaFeaturePreference(formData, user)
      : intent === 'updatePaymentPreference' || intent === null
        ? await submitMemberPaymentPreference(formData, user)
        : {
            ok: false,
            formError: 'Could not update this account setting yet.',
            fieldErrors: {},
          };

  return Response.json(result, {
    headers,
    status: result.ok ? 200 : 400,
  });
}

export default function AccountRoute() {
  const data = useLoaderData<typeof loader>() as LoaderData;

  return <AccountPage {...data} />;
}
