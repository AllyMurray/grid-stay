import { sendTransactionalEmail } from './ses.server';

export interface SendMemberInviteEmailInput {
  expiresAt?: string;
  invitedByName: string;
  request?: Request;
  to: string;
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

export function createMemberInviteLoginUrl(request?: Request) {
  return new URL('/auth/login', getAppBaseUrl(request)).toString();
}

function formatInviteExpiry(expiresAt?: string) {
  if (!expiresAt) {
    return 'This invite expires in 30 days.';
  }

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    return 'This invite expires in 30 days.';
  }

  return `This invite expires on ${new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date)}.`;
}

export function createMemberInviteText({
  expiresAt,
  invitedByName,
  loginUrl,
  to,
}: Pick<SendMemberInviteEmailInput, 'expiresAt' | 'invitedByName' | 'to'> & {
  loginUrl: string;
}) {
  return [
    'Grid Stay',
    '',
    `${invitedByName} invited you to Grid Stay.`,
    '',
    'Grid Stay is an invite-only planner for shared track days, hotels, garages, costs, and group calendars.',
    '',
    'Sign in with Google or create a password account using this email address:',
    to,
    '',
    'Open Grid Stay:',
    loginUrl,
    '',
    formatInviteExpiry(expiresAt),
    '',
    'If you were not expecting this invite, you can ignore this email.',
  ].join('\n');
}

export function createMemberInviteHtml({
  expiresAt,
  invitedByName,
  loginUrl,
  to,
}: Pick<SendMemberInviteEmailInput, 'expiresAt' | 'invitedByName' | 'to'> & {
  loginUrl: string;
}) {
  const safeInvitedByName = escapeHtml(invitedByName);
  const safeLoginUrl = escapeHtml(loginUrl);
  const safeTo = escapeHtml(to);
  const safeExpiry = escapeHtml(formatInviteExpiry(expiresAt));

  return `<!doctype html>
<html>
  <body style="margin:0;background-color:#f6f2ef;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${safeInvitedByName} invited you to Grid Stay. Sign in with Google or password using ${safeTo}.
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f2ef;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border:1px solid #eadde0;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="background-color:#11171d;padding:28px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <div style="display:inline-block;background-color:#5a001d;color:#ffffff;border-radius:8px;padding:10px 12px;font-size:18px;line-height:18px;font-weight:700;letter-spacing:0;">
                        /|\\
                      </div>
                    </td>
                    <td width="100%" style="vertical-align:middle;padding-left:14px;">
                      <div style="font-size:24px;line-height:30px;font-weight:800;color:#ffffff;letter-spacing:0;">
                        Grid Stay
                      </div>
                      <div style="font-size:13px;line-height:20px;color:#ff7aa2;margin-top:3px;">
                        Shared track-day planning
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 30px 30px;">
                <h1 style="font-size:28px;line-height:34px;margin:0 0 12px;color:#111827;font-weight:800;letter-spacing:0;">
                  You have been invited
                </h1>
                <p style="font-size:16px;line-height:24px;margin:0 0 24px;color:#4b5563;">
                  ${safeInvitedByName} invited you to join Grid Stay, the shared planner for track days, hotel stays, garages, costs, and group calendars.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <div style="font-size:13px;line-height:18px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;">
                        Invited email
                      </div>
                      <div style="font-size:18px;line-height:26px;font-weight:700;color:#111827;word-break:break-all;">
                        ${safeTo}
                      </div>
                      <div style="font-size:14px;line-height:22px;color:#6b7280;margin-top:8px;">
                        Use this email with Google sign-in or create a password account.
                      </div>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                  <tr>
                    <td style="background-color:#e42a57;border-radius:7px;">
                      <a href="${safeLoginUrl}" style="display:inline-block;padding:14px 22px;font-size:16px;line-height:20px;font-weight:800;color:#ffffff;text-decoration:none;">
                        Open Grid Stay
                      </a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 22px;">
                  <tr>
                    <td width="33.333%" style="padding:0 8px 0 0;vertical-align:top;">
                      <div style="font-size:13px;line-height:18px;font-weight:700;color:#111827;">Plan days</div>
                      <div style="font-size:13px;line-height:19px;color:#6b7280;margin-top:3px;">See shared booked and maybe dates.</div>
                    </td>
                    <td width="33.333%" style="padding:0 8px;vertical-align:top;">
                      <div style="font-size:13px;line-height:18px;font-weight:700;color:#111827;">Coordinate stays</div>
                      <div style="font-size:13px;line-height:19px;color:#6b7280;margin-top:3px;">Share hotels, arrival times, and garages.</div>
                    </td>
                    <td width="33.333%" style="padding:0 0 0 8px;vertical-align:top;">
                      <div style="font-size:13px;line-height:18px;font-weight:700;color:#111827;">Split costs</div>
                      <div style="font-size:13px;line-height:19px;color:#6b7280;margin-top:3px;">Track group expenses and settlements.</div>
                    </td>
                  </tr>
                </table>
                <p style="font-size:14px;line-height:22px;margin:0 0 12px;color:#6b7280;">
                  ${safeExpiry} If you were not expecting this invite, you can ignore this email.
                </p>
                <p style="font-size:12px;line-height:18px;margin:0;color:#9ca3af;word-break:break-all;">
                  ${safeLoginUrl}
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

export async function sendMemberInviteEmail({
  expiresAt,
  invitedByName,
  request,
  to,
}: SendMemberInviteEmailInput): Promise<void> {
  const loginUrl = createMemberInviteLoginUrl(request);

  await sendTransactionalEmail({
    to,
    subject: `${invitedByName} invited you to Grid Stay`,
    text: createMemberInviteText({ expiresAt, invitedByName, loginUrl, to }),
    html: createMemberInviteHtml({ expiresAt, invitedByName, loginUrl, to }),
  });
}
