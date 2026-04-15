# Deployment And Domains

This document covers the current production domain setup for Grid Stay and the
steps required when deploying new stages or changing hostnames.

## Current Setup

- Registrar: Porkbun
- DNS host: Route 53
- AWS region: `eu-west-1`
- CloudFront/ACM certificate region: `us-east-1`
- Default deploy profile: `personal`

## Stage Hostnames

- `prod`: `gridstay.app`
- `staging`: `staging.gridstay.app`
- `dev`: `dev.gridstay.app`

All three stages are configured in code. Only `prod` is currently deployed.

## Certificates

The site looks up the most recent issued ACM certificate for each stage hostname
in `us-east-1`.

- `gridstay.app`
- `staging.gridstay.app`
- `dev.gridstay.app`

The repo does not need to pin certificate ARNs. Do not store certificate
private keys, AWS credentials, or auth secrets in the repo.

## Repo Files That Control Domains

- [infra/domain.ts](/Users/ally/Projects/repos/grid-stay/infra/domain.ts)
  - stage hostname mapping
  - Route 53 hosted zone lookup
  - ACM certificate ARN mapping
- [infra/site.ts](/Users/ally/Projects/repos/grid-stay/infra/site.ts)
  - attaches the custom domain to the SST React site
  - injects `BETTER_AUTH_URL`
- [app/lib/auth/auth.server.ts](/Users/ally/Projects/repos/grid-stay/app/lib/auth/auth.server.ts)
  - uses `BETTER_AUTH_URL` as Better Auth `baseURL`

## Deploy Commands

Deploy production:

```bash
AWS_PROFILE=personal npx sst deploy --stage prod
```

Deploy staging:

```bash
AWS_PROFILE=personal npx sst deploy --stage staging
```

Deploy dev:

```bash
AWS_PROFILE=personal npx sst deploy --stage dev
```

## Google OAuth

Google sign-in must be configured for every deployed hostname.

For `prod`:

- Authorized JavaScript origin: `https://gridstay.app`
- Authorized redirect URI: `https://gridstay.app/api/auth/callback/google`

For `staging`:

- Authorized JavaScript origin: `https://staging.gridstay.app`
- Authorized redirect URI: `https://staging.gridstay.app/api/auth/callback/google`

For `dev`:

- Authorized JavaScript origin: `https://dev.gridstay.app`
- Authorized redirect URI: `https://dev.gridstay.app/api/auth/callback/google`

If Google OAuth is not updated before a stage goes live, sign-in will fail even
if the SST deploy succeeds.

## DNS Notes

- Porkbun is only the registrar.
- Route 53 is authoritative for `gridstay.app`.
- SST manages the Route 53 records through the hosted zone lookup in
  [infra/domain.ts](/Users/ally/Projects/repos/grid-stay/infra/domain.ts).

If the domain changes:

1. Update the hostname mapping in
   [infra/domain.ts](/Users/ally/Projects/repos/grid-stay/infra/domain.ts).
2. Make sure the matching ACM cert exists in `us-east-1`.
3. Make sure Route 53 is authoritative for the parent domain.
4. Deploy the stage.
5. Update Google OAuth origins and redirect URIs.

## Operational Notes

- Better Auth callbacks use `BETTER_AUTH_URL`; do not remove this unless auth is
  reworked.
- CloudFront custom domains require ACM certs in `us-east-1`, even though the
  rest of the app is in `eu-west-1`.
- DNS propagation can lag behind a successful deploy. If the SST output shows
  the correct site URL but the hostname does not resolve immediately, wait for
  propagation before treating it as a failed release.
