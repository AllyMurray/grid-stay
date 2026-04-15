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

const usEast1Provider = new aws.Provider('grid-stay-us-east-1', {
  region: 'us-east-1',
});

const getCertArn = (stageDomain: string) =>
  aws.acm
    .getCertificate(
      {
        domain: stageDomain,
        statuses: ['ISSUED'],
        mostRecent: true,
      },
      { provider: usEast1Provider },
    )
    .then((cert) => cert.arn);

const certArns = {
  prod: await getCertArn(stageDomains.prod),
  staging: await getCertArn(stageDomains.staging),
  dev: await getCertArn(stageDomains.dev),
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
