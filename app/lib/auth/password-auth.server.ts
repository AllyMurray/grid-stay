import { redirect } from 'react-router';
import { z } from 'zod';
import { auth } from './auth.server';
import { normalizeEmail } from './authorization';
import {
  appendClearDontRememberCookieHeaders,
  cloneHeadersPreservingSetCookie,
} from './cookies.server';
import { canCreateMemberAccountForEmail } from './member-invites.server';
import {
  type AccountPasswordActionData,
  PASSWORD_MIN_LENGTH,
  type PasswordAuthActionData,
  type PasswordResetActionData,
  type PasswordResetRequestActionData,
} from './password-auth.shared';

const EmailSchema = z.string().transform(normalizeEmail).pipe(z.email());

const PasswordSignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password is required.'),
});

const PasswordSignUpSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().min(1, 'Last name is required.'),
  email: EmailSchema,
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    ),
});

const SetPasswordSchema = z.object({
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    ),
});

const PasswordResetRequestSchema = z.object({
  email: EmailSchema,
});

const PasswordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    ),
});

function errorResponse(
  data: PasswordAuthActionData,
  headers?: HeadersInit,
): Response {
  return Response.json(data, { status: 400, headers });
}

function accountErrorResponse(
  data: AccountPasswordActionData,
  headers?: HeadersInit,
): Response {
  return Response.json(data, { status: 400, headers });
}

function passwordResetRequestErrorResponse(
  data: PasswordResetRequestActionData,
  headers?: HeadersInit,
): Response {
  return Response.json(data, { status: 400, headers });
}

function passwordResetErrorResponse(
  data: PasswordResetActionData,
  headers?: HeadersInit,
): Response {
  return Response.json(data, { status: 400, headers });
}

async function readAuthError(response: Response, fallback: string) {
  try {
    const body = (await response.clone().json()) as {
      message?: string;
      code?: string;
    };

    if (body.code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
      return 'This email already has an account. Sign in with Google first, then set a password from Account.';
    }

    if (
      body.code === 'INVALID_EMAIL_OR_PASSWORD' ||
      body.code === 'CREDENTIAL_ACCOUNT_NOT_FOUND'
    ) {
      return 'Email or password is incorrect.';
    }

    if (body.code === 'PASSWORD_ALREADY_SET') {
      return 'Password sign-in is already enabled for this account.';
    }

    if (body.code === 'INVALID_TOKEN') {
      return 'This reset link is invalid or has expired.';
    }

    if (body.code === 'PASSWORD_TOO_SHORT') {
      return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
    }

    if (body.code === 'PASSWORD_TOO_LONG') {
      return 'Password is too long.';
    }

    if (body.code === 'RESET_PASSWORD_DISABLED') {
      return 'Password reset is not available yet.';
    }

    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

function getResetPasswordRedirectTo(request: Request) {
  return new URL('/auth/reset-password', request.url).toString();
}

export function sanitizeRedirectTo(value: FormDataEntryValue | string | null) {
  const raw = value?.toString() || '/dashboard';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
}

export async function submitPasswordSignIn(
  request: Request,
  formData: FormData,
): Promise<Response> {
  const parsed = PasswordSignInSchema.safeParse(Object.fromEntries(formData));
  const redirectTo = sanitizeRedirectTo(formData.get('redirectTo'));

  if (!parsed.success) {
    return errorResponse({
      intent: 'passwordSignIn',
      formError: 'Check the sign-in details and try again.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const response = await auth.api.signInEmail({
    body: {
      email: parsed.data.email,
      password: parsed.data.password,
      callbackURL: redirectTo,
      rememberMe: true,
    },
    headers: request.headers,
    asResponse: true,
  });
  const headers = appendClearDontRememberCookieHeaders(response.headers);

  if (!response.ok) {
    return errorResponse(
      {
        intent: 'passwordSignIn',
        formError: await readAuthError(response, 'Unable to sign in.'),
        fieldErrors: {},
      },
      headers,
    );
  }

  throw redirect(redirectTo, { headers });
}

export async function submitPasswordSignUp(
  request: Request,
  formData: FormData,
): Promise<Response> {
  const parsed = PasswordSignUpSchema.safeParse(Object.fromEntries(formData));
  const redirectTo = sanitizeRedirectTo(formData.get('redirectTo'));

  if (!parsed.success) {
    return errorResponse({
      intent: 'passwordSignUp',
      formError: 'Check the account details and try again.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  if (!(await canCreateMemberAccountForEmail(parsed.data.email))) {
    return errorResponse({
      intent: 'passwordSignUp',
      formError:
        'Ask an existing member to invite this email before creating an account.',
      fieldErrors: {},
    });
  }

  const response = await auth.api.signUpEmail({
    body: {
      name: `${parsed.data.firstName} ${parsed.data.lastName}`,
      email: parsed.data.email,
      password: parsed.data.password,
      callbackURL: redirectTo,
      rememberMe: true,
    },
    headers: request.headers,
    asResponse: true,
  });
  const headers = appendClearDontRememberCookieHeaders(response.headers);

  if (!response.ok) {
    return errorResponse(
      {
        intent: 'passwordSignUp',
        formError: await readAuthError(response, 'Unable to create account.'),
        fieldErrors: {},
      },
      headers,
    );
  }

  throw redirect(redirectTo, { headers });
}

export async function getPasswordAccountStatus(
  request: Request,
): Promise<{ hasPassword: boolean; headers: Headers }> {
  const response = await auth.api.listUserAccounts({
    headers: request.headers,
    asResponse: true,
  });
  const headers = cloneHeadersPreservingSetCookie(response.headers);

  if (!response.ok) {
    return { hasPassword: false, headers };
  }

  const accounts = (await response.json()) as Array<{ providerId: string }>;
  return {
    hasPassword: accounts.some(
      (account) => account.providerId === 'credential',
    ),
    headers,
  };
}

export async function submitSetPassword(
  request: Request,
  formData: FormData,
  authHeaders?: HeadersInit,
): Promise<Response> {
  const parsed = SetPasswordSchema.safeParse(Object.fromEntries(formData));
  const headers = cloneHeadersPreservingSetCookie(authHeaders);

  if (!parsed.success) {
    return accountErrorResponse(
      {
        ok: false,
        formError: 'Check the password and try again.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      headers,
    );
  }

  const response = await auth.api.setPassword({
    body: { newPassword: parsed.data.password },
    headers: request.headers,
    asResponse: true,
  });

  for (const cookie of response.headers.getSetCookie()) {
    headers.append('set-cookie', cookie);
  }

  if (!response.ok) {
    return accountErrorResponse(
      {
        ok: false,
        formError: await readAuthError(response, 'Unable to set password.'),
        fieldErrors: {},
      },
      headers,
    );
  }

  return Response.json(
    {
      ok: true,
      message: 'Password sign-in is enabled for this account.',
      fieldErrors: {},
    } satisfies AccountPasswordActionData,
    { headers },
  );
}

export async function submitPasswordResetRequest(
  request: Request,
  formData: FormData,
): Promise<Response> {
  const parsed = PasswordResetRequestSchema.safeParse(
    Object.fromEntries(formData),
  );

  if (!parsed.success) {
    return passwordResetRequestErrorResponse({
      ok: false,
      formError: 'Enter a valid email address.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const response = await auth.api.requestPasswordReset({
    body: {
      email: parsed.data.email,
      redirectTo: getResetPasswordRedirectTo(request),
    },
    headers: request.headers,
    asResponse: true,
  });
  const headers = cloneHeadersPreservingSetCookie(response.headers);

  if (!response.ok) {
    return passwordResetRequestErrorResponse(
      {
        ok: false,
        formError: await readAuthError(
          response,
          'Unable to send password reset link.',
        ),
        fieldErrors: {},
      },
      headers,
    );
  }

  return Response.json(
    {
      ok: true,
      message:
        'If there is an account for that email, we sent a password reset link.',
      fieldErrors: {},
    } satisfies PasswordResetRequestActionData,
    { headers },
  );
}

export async function submitPasswordReset(
  request: Request,
  formData: FormData,
): Promise<Response> {
  const parsed = PasswordResetSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return passwordResetErrorResponse({
      ok: false,
      formError: 'Check the password and try again.',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
  }

  const response = await auth.api.resetPassword({
    body: {
      token: parsed.data.token,
      newPassword: parsed.data.password,
    },
    headers: request.headers,
    asResponse: true,
  });
  const headers = cloneHeadersPreservingSetCookie(response.headers);

  if (!response.ok) {
    return passwordResetErrorResponse(
      {
        ok: false,
        formError: await readAuthError(response, 'Unable to reset password.'),
        fieldErrors: {},
      },
      headers,
    );
  }

  throw redirect('/auth/login?passwordReset=success', { headers });
}
