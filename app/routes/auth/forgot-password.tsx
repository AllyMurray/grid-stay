import { useActionData } from 'react-router';
import { appendClearDontRememberCookieHeaders } from '~/lib/auth/cookies.server';
import { requireAnonymous } from '~/lib/auth/helpers.server';
import { submitPasswordResetRequest } from '~/lib/auth/password-auth.server';
import type { PasswordResetRequestActionData } from '~/lib/auth/password-auth.shared';
import { ForgotPasswordPage } from '~/pages/auth/forgot-password';
import type { Route } from './+types/forgot-password';

export async function loader({ request }: Route.LoaderArgs) {
  const authHeaders = await requireAnonymous(request);

  return Response.json(
    {},
    {
      headers: appendClearDontRememberCookieHeaders(authHeaders),
    },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  return submitPasswordResetRequest(request, formData);
}

export default function ForgotPasswordRoute() {
  const actionData = useActionData<typeof action>() as
    | PasswordResetRequestActionData
    | undefined;

  return <ForgotPasswordPage actionData={actionData} />;
}
