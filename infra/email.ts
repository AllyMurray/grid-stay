import { appName, domain, hostedZoneId, mailFromDomain } from './domain';

const dns = hostedZoneId ? sst.aws.dns({ zone: hostedZoneId }) : false;
const managesEmailIdentity = $app.stage === 'prod';

export const email = managesEmailIdentity
  ? new sst.aws.Email('Email', {
      sender: domain,
      dns,
      dmarc: 'v=DMARC1; p=none;',
      transform: {
        identity(args) {
          args.emailIdentity = domain;
        },
        configurationSet(args) {
          args.configurationSetName = `${appName}-email-${$app.stage}`;
        },
      },
    })
  : sst.aws.Email.get('Email', domain);

if (managesEmailIdentity) {
  new aws.sesv2.EmailIdentityMailFromAttributes('EmailMailFrom', {
    emailIdentity: email.nodes.identity.emailIdentity,
    behaviorOnMxFailure: 'REJECT_MESSAGE',
    mailFromDomain,
  });

  if (hostedZoneId) {
    new aws.route53.Record('EmailMailFromMx', {
      zoneId: hostedZoneId,
      name: mailFromDomain,
      type: 'MX',
      ttl: 300,
      records: ['10 feedback-smtp.eu-west-1.amazonses.com'],
    });

    new aws.route53.Record('EmailMailFromSpf', {
      zoneId: hostedZoneId,
      name: mailFromDomain,
      type: 'TXT',
      ttl: 300,
      records: ['v=spf1 include:amazonses.com ~all'],
    });
  }
}
