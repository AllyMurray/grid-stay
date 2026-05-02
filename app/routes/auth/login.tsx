import { useActionData, useLoaderData } from 'react-router';
import { appendClearDontRememberCookieHeaders } from '~/lib/auth/cookies.server';
import { requireAnonymous } from '~/lib/auth/helpers.server';
import {
  sanitizeRedirectTo,
  submitPasswordSignIn,
  submitPasswordSignUp,
} from '~/lib/auth/password-auth.server';
import type { PasswordAuthActionData } from '~/lib/auth/password-auth.shared';
import { isPasswordAuthEnabled } from '~/lib/auth/password-auth-availability.server';
import { LoginPage } from '~/pages/auth/login';
import type { Route } from './+types/login';

interface LoaderData {
  notice?: string;
  passwordAuthAvailable: boolean;
  redirectTo: string;
}

export async function loader({ request }: Route.LoaderArgs) {
  const authHeaders = await requireAnonymous(request);

  const url = new URL(request.url);
  const redirectTo = sanitizeRedirectTo(url.searchParams.get('redirectTo'));
  const passwordAuthAvailable = isPasswordAuthEnabled();
  const notice =
    passwordAuthAvailable && url.searchParams.get('passwordReset') === 'success'
      ? 'Password reset. You can sign in with your new password.'
      : undefined;

  return Response.json(
    { notice, passwordAuthAvailable, redirectTo } satisfies LoaderData,
    {
      headers: appendClearDontRememberCookieHeaders(authHeaders),
    },
  );
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
  const actionData = useActionData<typeof action>() as
    | PasswordAuthActionData
    | undefined;

  return (
    <LoginPage
      actionData={actionData}
      notice={loaderData.notice}
      passwordAuthAvailable={loaderData.passwordAuthAvailable}
      redirectTo={loaderData.redirectTo}
    />
  );
}
