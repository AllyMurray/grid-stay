export const PASSWORD_MIN_LENGTH = 8;

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
