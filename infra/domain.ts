export const appName = 'grid-stay';

const domain = 'gridstay.app';

const usEast1Provider = new aws.Provider('grid-stay-us-east-1', {
  region: 'us-east-1',
});

function getStageDomain(stage: string) {
  if (stage === 'prod') {
    return domain;
  }

  if (stage === 'staging' || stage === 'dev') {
    return `${stage}.${domain}`;
  }

  return undefined;
}

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

const stageDomain = getStageDomain($app.stage);

const hostedZoneId = stageDomain
  ? await aws.route53.getZone({ name: `${domain}.` }).then((zone) => zone.zoneId)
  : undefined;

const certArn = stageDomain ? await getCertArn(stageDomain) : undefined;

export const appDomainConfig =
  stageDomain && hostedZoneId && certArn
    ? {
        name: stageDomain,
        cert: certArn,
        dns: sst.aws.dns({ zone: hostedZoneId }),
      }
    : undefined;
