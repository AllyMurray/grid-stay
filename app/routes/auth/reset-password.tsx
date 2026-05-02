import { useActionData, useLoaderData } from 'react-router';
import { appendClearDontRememberCookieHeaders } from '~/lib/auth/cookies.server';
import { requireAnonymous } from '~/lib/auth/helpers.server';
import { submitPasswordReset } from '~/lib/auth/password-auth.server';
import type { PasswordResetActionData } from '~/lib/auth/password-auth.shared';
import { ResetPasswordPage } from '~/pages/auth/reset-password';
import type { Route } from './+types/reset-password';

interface LoaderData {
  token?: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const authHeaders = await requireAnonymous(request);
  const url = new URL(request.url);
  const token = url.searchParams.get('token')?.trim() || undefined;

  return Response.json({ token } satisfies LoaderData, {
    headers: appendClearDontRememberCookieHeaders(authHeaders),
  });
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();

  return submitPasswordReset(request, formData);
}

export default function ResetPasswordRoute() {
  const { token } = useLoaderData<typeof loader>() as LoaderData;
  const actionData = useActionData<typeof action>() as
    | PasswordResetActionData
    | undefined;

  return <ResetPasswordPage actionData={actionData} token={token} />;
}
