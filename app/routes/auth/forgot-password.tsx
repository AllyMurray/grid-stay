import { redirect, useActionData } from 'react-router';
import { appendClearDontRememberCookieHeaders } from '~/lib/auth/cookies.server';
import { requireAnonymous } from '~/lib/auth/helpers.server';
import { submitPasswordResetRequest } from '~/lib/auth/password-auth.server';
import type { PasswordResetRequestActionData } from '~/lib/auth/password-auth.shared';
import { isPasswordAuthEnabled } from '~/lib/auth/password-auth-availability.server';
import { ForgotPasswordPage } from '~/pages/auth/forgot-password';
import type { Route } from './+types/forgot-password';

export async function loader({ request }: Route.LoaderArgs) {
  if (!isPasswordAuthEnabled()) {
    throw redirect('/auth/login');
  }

  const authHeaders = await requireAnonymous(request);

  return Response.json(
    {},
    {
      headers: appendClearDontRememberCookieHeaders(authHeaders),
    },
  );
}

export async function action({ request }: Route.ActionArgs) {
  if (!isPasswordAuthEnabled()) {
    throw redirect('/auth/login');
  }

  const formData = await request.formData();

  return submitPasswordResetRequest(request, formData);
}

export default function ForgotPasswordRoute() {
  const actionData = useActionData<typeof action>() as
    | PasswordResetRequestActionData
    | undefined;

  return <ForgotPasswordPage actionData={actionData} />;
}
