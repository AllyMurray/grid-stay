import { describe, expect, it, vi } from 'vite-plus/test';

const { sendTransactionalEmail } = vi.hoisted(() => ({
  sendTransactionalEmail: vi.fn(),
}));

vi.mock('./ses.server', () => ({
  sendTransactionalEmail,
}));

import {
  createMemberInviteHtml,
  createMemberInviteLoginUrl,
  sendMemberInviteEmail,
} from './member-invite.server';

describe('member invite email', () => {
  it('builds login links on the app auth route', () => {
    expect(
      createMemberInviteLoginUrl(new Request('https://gridstay.app/dashboard/members')),
    ).toBe('https://gridstay.app/auth/login');
  });

  it('sends a branded email with the invited address and expiry', async () => {
    await sendMemberInviteEmail({
      expiresAt: '2026-06-07T10:00:00.000Z',
      invitedByName: 'Ally Murray',
      request: new Request('https://gridstay.app/dashboard/members'),
      to: 'driver@example.com',
    });

    expect(sendTransactionalEmail).toHaveBeenCalledWith({
      to: 'driver@example.com',
      subject: 'Ally Murray invited you to Grid Stay',
      text: expect.stringContaining('Ally Murray invited you to Grid Stay.'),
      html: expect.stringContaining('You have been invited'),
    });
    expect(sendTransactionalEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('driver@example.com'),
        text: expect.stringContaining('This invite expires on 7 June 2026.'),
      }),
    );
  });

  it('escapes user-provided values in the html template', () => {
    const html = createMemberInviteHtml({
      invitedByName: '<Admin>',
      loginUrl: 'https://gridstay.app/auth/login',
      to: 'driver+test@example.com',
    });

    expect(html).toContain('&lt;Admin&gt;');
    expect(html).not.toContain('<Admin>');
    expect(html).toContain('driver+test@example.com');
  });
});
