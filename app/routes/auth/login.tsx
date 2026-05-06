import { useActionData, useLoaderData } from 'react-router';
import { appendClearDontRememberCookieHeaders } from '~/lib/auth/cookies.server';
import { requireAnonymous } from '~/lib/auth/helpers.server';
import {
  sanitizeRedirectTo,
  submitPasswordSignIn,
  submitPasswordSignUp,
} from '~/lib/auth/password-auth.server';
import type { PasswordAuthActionData } from '~/lib/auth/password-auth.shared';
import { LoginPage } from '~/pages/auth/login';
import type { Route } from './+types/login';

interface LoaderData {
  authError?: string;
  notice?: string;
  redirectTo: string;
}

function getAuthErrorMessage(error: string | null): string | undefined {
  if (!error) {
    return undefined;
  }

  if (
    error === 'unable_to_create_user' ||
    error === 'signup_disabled' ||
    error === 'account_not_linked'
  ) {
    return 'Google could not create an account for that address. Check the invited email or join link, or use password sign-up.';
  }

  if (error === 'state_mismatch' || error === 'please_restart_the_process') {
    return 'Google sign-in expired. Please try again.';
  }

  return 'Google sign-in could not be completed. Please try again.';
}

export async function loader({ request }: Route.LoaderArgs) {
  const authHeaders = await requireAnonymous(request);

  const url = new URL(request.url);
  const redirectTo = sanitizeRedirectTo(url.searchParams.get('redirectTo'));
  const authError = getAuthErrorMessage(url.searchParams.get('error'));
  const notice =
    url.searchParams.get('passwordReset') === 'success'
      ? 'Password reset. You can sign in with your new password.'
      : undefined;

  return Response.json({ authError, notice, redirectTo } satisfies LoaderData, {
    headers: appendClearDontRememberCookieHeaders(authHeaders),
  });
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'passwordSignIn') {
    return submitPasswordSignIn(request, formData);
  }

  if (intent === 'passwordSignUp') {
    return submitPasswordSignUp(request, formData);
  }

  return Response.json(
    {
      intent: 'passwordSignIn',
      formError: 'Choose a sign-in option and try again.',
      fieldErrors: {},
    } satisfies PasswordAuthActionData,
    { status: 400 },
  );
}

export default function Login() {
  const loaderData = useLoaderData<typeof loader>() as LoaderData;
  const actionData = useActionData<typeof action>() as PasswordAuthActionData | undefined;

  return (
    <LoginPage
      actionData={actionData}
      authError={loaderData.authError}
      notice={loaderData.notice}
      redirectTo={loaderData.redirectTo}
    />
  );
}
