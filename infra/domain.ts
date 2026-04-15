export const appName = 'grid-stay';

const domain = 'gridstay.app';

const hostedZone = aws.route53.getZone({
  name: `${domain}.`,
});

export const hostedZoneId = await hostedZone.then((zone) => zone.zoneId);

const stageDomains = {
  prod: domain,
  staging: `staging.${domain}`,
  dev: `dev.${domain}`,
} as const;

const certArns = {
  prod: 'arn:aws:acm:us-east-1:624085162128:certificate/890ffa10-a7fc-4f87-b485-74cc3c7d4a88',
  staging:
    'arn:aws:acm:us-east-1:624085162128:certificate/a1e87c4d-1ca7-47d5-84e9-244a501791c8',
  dev: 'arn:aws:acm:us-east-1:624085162128:certificate/613d857d-362b-460b-b646-11970f0c2f79',
} as const;

const createDomainConfig = () => {
  const stage = $app.stage as keyof typeof stageDomains;
  const name = stageDomains[stage];
  const cert = certArns[stage];

  if (!name || !cert) {
    return undefined;
  }

  return {
    name,
    cert,
    dns: sst.aws.dns({ zone: hostedZoneId }),
  };
};

export const appDomainConfig = createDomainConfig();
