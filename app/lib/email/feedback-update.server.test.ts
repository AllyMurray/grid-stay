import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendTransactionalEmail } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('./ses.server', () => ({
  sendTransactionalEmail,
}));

import { sendFeedbackUpdateEmail } from './feedback-update.server';

describe('feedback update email', () => {
  beforeEach(() => {
    sendTransactionalEmail.mockReset();
    sendTransactionalEmail.mockResolvedValue(undefined);
  });

  it('sends a feedback update email linking back to the dashboard feedback page', async () => {
    await sendFeedbackUpdateEmail({
      request: new Request('https://gridstay.app/dashboard/admin/feedback'),
      feedback: {
        title: 'Saved filter presets',
        status: 'planned',
        userEmail: 'driver@example.com',
      },
      update: {
        message: 'We have started work on this request.',
      },
    });

    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'driver@example.com',
        subject: 'Update on your Grid Stay feedback: Saved filter presets',
        text: expect.stringContaining('Current status: Planned'),
        html: expect.stringContaining('Open feedback'),
      }),
    );

    const input = sendTransactionalEmail.mock.calls[0]?.[0];
    expect(input?.text).toContain('https://gridstay.app/dashboard/feedback');
    expect(input?.text).toContain('We have started work on this request.');
    expect(input?.html).toContain('https://gridstay.app/dashboard/feedback');
  });
});
