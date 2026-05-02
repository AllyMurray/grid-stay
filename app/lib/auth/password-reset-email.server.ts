import { sendTransactionalEmail } from '~/lib/email/ses.server';

interface SendPasswordResetEmailInput {
  request?: Request;
  to: string;
  token: string;
}

function getAppBaseUrl(request?: Request) {
  if (process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL;
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return 'http://localhost:5173';
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createPasswordResetUrl({
  request,
  token,
}: Pick<SendPasswordResetEmailInput, 'request' | 'token'>) {
  const url = new URL('/auth/reset-password', getAppBaseUrl(request));
  url.searchParams.set('token', token);
  return url.toString();
}

export async function sendPasswordResetEmail({
  request,
  to,
  token,
}: SendPasswordResetEmailInput): Promise<void> {
  const resetUrl = createPasswordResetUrl({ request, token });
  const safeResetUrl = escapeHtml(resetUrl);

  await sendTransactionalEmail({
    to,
    subject: 'Reset your Grid Stay password',
    text: [
      'Use this link to reset your Grid Stay password:',
      '',
      resetUrl,
      '',
      'This link expires in one hour. If you did not request it, you can ignore this email.',
    ].join('\n'),
    html: [
      '<p>Use this link to reset your Grid Stay password:</p>',
      `<p><a href="${safeResetUrl}">Reset your password</a></p>`,
      '<p>This link expires in one hour. If you did not request it, you can ignore this email.</p>',
    ].join(''),
  });
}
