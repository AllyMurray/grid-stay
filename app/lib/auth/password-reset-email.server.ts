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

function createPasswordResetText(resetUrl: string) {
  return [
    'Grid Stay',
    '',
    'Reset your password',
    '',
    'Open this secure link to choose a new password:',
    '',
    resetUrl,
    '',
    'This link expires in one hour.',
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');
}

function createPasswordResetHtml(resetUrl: string) {
  const safeResetUrl = escapeHtml(resetUrl);

  return `<!doctype html>
<html>
  <body style="margin:0;background-color:#f6f2ef;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Reset your Grid Stay password. This link expires in one hour.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f2ef;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #eadde0;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#111827;padding:24px 28px;">
                <div style="font-size:22px;line-height:28px;font-weight:700;color:#ffffff;letter-spacing:0;">
                  Grid Stay
                </div>
                <div style="font-size:13px;line-height:20px;color:#fda4af;margin-top:4px;">
                  Race weekend planning
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 28px;">
                <h1 style="font-size:26px;line-height:32px;margin:0 0 12px;color:#111827;font-weight:700;">
                  Reset your password
                </h1>
                <p style="font-size:16px;line-height:24px;margin:0 0 24px;color:#4b5563;">
                  Open this secure link to choose a new password for your Grid Stay account.
                </p>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
                  <tr>
                    <td style="background-color:#e42a57;border-radius:6px;">
                      <a href="${safeResetUrl}" style="display:inline-block;padding:13px 20px;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">
                        Reset password
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="font-size:14px;line-height:22px;margin:0 0 12px;color:#6b7280;">
                  This link expires in one hour. If you did not request this, you can ignore this email.
                </p>
                <p style="font-size:12px;line-height:18px;margin:0;color:#9ca3af;word-break:break-all;">
                  ${safeResetUrl}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPasswordResetEmail({
  request,
  to,
  token,
}: SendPasswordResetEmailInput): Promise<void> {
  const resetUrl = createPasswordResetUrl({ request, token });

  await sendTransactionalEmail({
    to,
    subject: 'Reset your Grid Stay password',
    text: createPasswordResetText(resetUrl),
    html: createPasswordResetHtml(resetUrl),
  });
}
