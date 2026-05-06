import type { FeedbackAdminUpdate, FeedbackThread } from '~/lib/db/services/feedback.server';
import { sendTransactionalEmail } from './ses.server';

interface SendFeedbackUpdateEmailInput {
  request?: Request;
  feedback: Pick<FeedbackThread, 'status' | 'title' | 'userEmail'>;
  update: Pick<FeedbackAdminUpdate, 'message'>;
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

function createFeedbackUrl(request?: Request) {
  return new URL('/dashboard/feedback', getAppBaseUrl(request)).toString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatStatus(status: FeedbackThread['status']) {
  if (status === 'closed') {
    return 'Done';
  }

  return status.replace(/\b\w/g, (char) => char.toUpperCase());
}

function createFeedbackUpdateText(
  title: string,
  status: FeedbackThread['status'],
  message: string,
  feedbackUrl: string,
) {
  return [
    'Grid Stay',
    '',
    `Your feedback has an update: ${title}`,
    '',
    `Current status: ${formatStatus(status)}`,
    '',
    'Latest admin update:',
    message,
    '',
    'Open your feedback page to review the thread:',
    feedbackUrl,
  ].join('\n');
}

function createFeedbackUpdateHtml(
  title: string,
  status: FeedbackThread['status'],
  message: string,
  feedbackUrl: string,
) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replaceAll('\n', '<br />');
  const safeStatus = escapeHtml(formatStatus(status));
  const safeFeedbackUrl = escapeHtml(feedbackUrl);

  return `<!doctype html>
<html>
  <body style="margin:0;background-color:#f6f2ef;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f6f2ef;margin:0;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border:1px solid #eadde0;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background-color:#111827;padding:24px 28px;">
                <div style="font-size:22px;line-height:28px;font-weight:700;color:#ffffff;">
                  Grid Stay
                </div>
                <div style="font-size:13px;line-height:20px;color:#fda4af;margin-top:4px;">
                  Feedback update
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px 28px;">
                <h1 style="font-size:24px;line-height:30px;margin:0 0 12px;color:#111827;font-weight:700;">
                  ${safeTitle}
                </h1>
                <p style="font-size:15px;line-height:22px;margin:0 0 12px;color:#4b5563;">
                  Current status: <strong>${safeStatus}</strong>
                </p>
                <div style="font-size:15px;line-height:24px;margin:0 0 24px;color:#1f2933;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;">
                  ${safeMessage}
                </div>
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
                  <tr>
                    <td style="background-color:#e42a57;border-radius:6px;">
                      <a href="${safeFeedbackUrl}" style="display:inline-block;padding:13px 20px;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">
                        Open feedback
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="font-size:12px;line-height:18px;margin:0;color:#9ca3af;word-break:break-all;">
                  ${safeFeedbackUrl}
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

export async function sendFeedbackUpdateEmail({
  request,
  feedback,
  update,
}: SendFeedbackUpdateEmailInput): Promise<void> {
  const feedbackUrl = createFeedbackUrl(request);

  await sendTransactionalEmail({
    to: feedback.userEmail,
    subject: `Update on your Grid Stay feedback: ${feedback.title}`,
    text: createFeedbackUpdateText(feedback.title, feedback.status, update.message, feedbackUrl),
    html: createFeedbackUpdateHtml(feedback.title, feedback.status, update.message, feedbackUrl),
  });
}
