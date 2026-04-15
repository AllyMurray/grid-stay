# Grid Stay

Grid Stay is a motorsport trip planner for a small racing group. It combines
upcoming race days, test days, and track days into one dashboard, then lets
each driver keep their own booking references private while sharing where the
group is staying.

## Stack

- React Router 7 route modules
- React 19
- Mantine UI
- Better Auth with Google sign-in only
- SST
- DynamoDB + ElectroDB
- Zod
- Vitest

## Main Routes

- `/dashboard/days`: unified available-days feed with filters, attendee counts,
  and shared accommodation summaries
- `/dashboard/bookings`: private booking management for the signed-in user

## Privacy Model

- Shared: attendee name, attendance status, accommodation name
- Private: booking reference, accommodation reference, notes

## Local Development

1. Install dependencies with `pnpm install`
2. Configure SST secrets for `GoogleClientId`, `GoogleClientSecret`, and `BetterAuthSecret`
3. Run `pnpm dev`

## Deployment

See [docs/deployment-and-domains.md](/Users/ally/Projects/repos/grid-stay/docs/deployment-and-domains.md)
for the current domain setup, stage hostnames, certificate mapping, deploy
commands, and Google OAuth configuration.

## Future Improvements

- If `/dashboard/days` needs to move below the current sub-second first load,
  split the cached available-days snapshot into smaller DynamoDB shards instead
  of reading one larger blob, and trim any nonessential metadata from the first
  page response before lazy-loaded follow-up requests.

The implementation structure follows the same stack and route-module patterns
as the nearby `apex-book` repo, but reduced to the Grid Stay product surface.
