export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_AUTH_UNAVAILABLE_MESSAGE =
  'Password sign-in is not available yet.';

export type PasswordAuthIntent = 'passwordSignIn' | 'passwordSignUp';

export interface PasswordAuthActionData {
  intent: PasswordAuthIntent;
  formError?: string;
  fieldErrors: Partial<
    Record<
      'email' | 'password' | 'firstName' | 'lastName',
      string[] | undefined
    >
  >;
}

export type AccountPasswordActionData =
  | {
      ok: true;
      message: string;
      fieldErrors: Partial<Record<'password', string[] | undefined>>;
      formError?: string;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<'password', string[] | undefined>>;
    };

export type PasswordResetRequestActionData =
  | {
      ok: true;
      message: string;
      fieldErrors: Partial<Record<'email', string[] | undefined>>;
      formError?: string;
    }
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<'email', string[] | undefined>>;
    };

export type PasswordResetActionData =
  | {
      ok: false;
      formError: string;
      fieldErrors: Partial<Record<'password' | 'token', string[] | undefined>>;
    }
  | {
      ok: true;
      message: string;
      fieldErrors: Partial<Record<'password' | 'token', string[] | undefined>>;
      formError?: string;
    };
