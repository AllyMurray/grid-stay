import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { Resource } from 'sst';

interface LinkedEmailResource {
  Email: {
    configSet: string;
    sender: string;
  };
}

interface SendTransactionalEmailInput {
  html?: string;
  subject: string;
  text: string;
  to: string;
}

const sesClient = new SESv2Client({});
const SSTResource = Resource as unknown as LinkedEmailResource;

function getFromEmailAddress() {
  return (
    process.env.GRID_STAY_EMAIL_FROM ??
    `Grid Stay <noreply@${SSTResource.Email.sender}>`
  );
}

export async function sendTransactionalEmail({
  html,
  subject,
  text,
  to,
}: SendTransactionalEmailInput): Promise<void> {
  await sesClient.send(
    new SendEmailCommand({
      FromEmailAddress: getFromEmailAddress(),
      ConfigurationSetName: SSTResource.Email.configSet,
      Destination: {
        ToAddresses: [to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: text,
              Charset: 'UTF-8',
            },
            ...(html
              ? {
                  Html: {
                    Data: html,
                    Charset: 'UTF-8',
                  },
                }
              : {}),
          },
        },
      },
    }),
  );
}
