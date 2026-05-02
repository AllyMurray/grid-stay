import { beforeEach, describe, expect, it, vi } from 'vitest';

const { send, sendEmailCommand } = vi.hoisted(() => ({
  send: vi.fn(),
  sendEmailCommand: vi.fn(function SendEmailCommand(input) {
    return { input };
  }),
}));

vi.mock('@aws-sdk/client-sesv2', () => ({
  SESv2Client: vi.fn(function SESv2Client() {
    return { send };
  }),
  SendEmailCommand: sendEmailCommand,
}));

vi.mock('sst', () => ({
  Resource: {
    Email: {
      configSet: 'grid-stay-email-prod',
      sender: 'gridstay.app',
    },
  },
}));

import { sendTransactionalEmail } from './ses.server';

describe('SES transactional email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('sends from the linked Grid Stay SES identity', async () => {
    await sendTransactionalEmail({
      to: 'driver@example.com',
      subject: 'Reset your password',
      text: 'Plain text body',
      html: '<p>HTML body</p>',
    });

    expect(sendEmailCommand).toHaveBeenCalledWith({
      FromEmailAddress: 'Grid Stay <noreply@gridstay.app>',
      ConfigurationSetName: 'grid-stay-email-prod',
      Destination: {
        ToAddresses: ['driver@example.com'],
      },
      Content: {
        Simple: {
          Subject: {
            Data: 'Reset your password',
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: 'Plain text body',
              Charset: 'UTF-8',
            },
            Html: {
              Data: '<p>HTML body</p>',
              Charset: 'UTF-8',
            },
          },
        },
      },
    });
    expect(send).toHaveBeenCalledWith({
      input: expect.objectContaining({
        FromEmailAddress: 'Grid Stay <noreply@gridstay.app>',
      }),
    });
  });

  it('allows the sender display address to be overridden by environment', async () => {
    vi.stubEnv('GRID_STAY_EMAIL_FROM', 'Grid Stay Test <test@gridstay.app>');

    await sendTransactionalEmail({
      to: 'driver@example.com',
      subject: 'Subject',
      text: 'Body',
    });

    expect(sendEmailCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        FromEmailAddress: 'Grid Stay Test <test@gridstay.app>',
      }),
    );
  });
});
