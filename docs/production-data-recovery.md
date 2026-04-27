# Production Data Recovery

Grid Stay stores production application data in DynamoDB:

- `grid-stay-prod`
- `grid-stay-auth-prod`

Both tables should have point-in-time recovery enabled for 35 days and deletion
protection enabled.

## Verify Data Protection

Run this before production deploys or after infrastructure changes:

```sh
AWS_PROFILE=personal pnpm check:prod:data-protection
```

The script checks both production DynamoDB tables in `eu-west-1` for:

- point-in-time recovery enabled
- 35 day recovery period
- deletion protection enabled

## Restore From PITR

Choose a restore timestamp before the bad write or deletion. DynamoDB restores to
a new table, not over the existing table.

```sh
AWS_PROFILE=personal aws dynamodb restore-table-to-point-in-time \
  --region eu-west-1 \
  --source-table-name grid-stay-prod \
  --target-table-name grid-stay-prod-restore-YYYYMMDD-HHMM \
  --restore-date-time '2026-04-27T12:00:00Z'
```

Repeat for `grid-stay-auth-prod` only if auth/member records are affected.

## Validate A Restore

1. Confirm the restored table exists and is `ACTIVE`.
2. Inspect a sample of affected records with `aws dynamodb scan` or a targeted
   query.
3. Compare restored records with the current table before copying anything back.
4. Export the current production state from `/dashboard/admin/export`.
5. Copy back only the records needed to repair the incident.

Do not point the app at a restored table unless the whole production dataset
needs to roll back. For most incidents, restore to a side table and selectively
repair records.

## App-Level Recovery Tools

- `/dashboard/admin/export` downloads a JSON copy of members, invites,
  bookings, manual days, shared plans, series subscriptions, calendar feed
  metadata, and the available-days cache snapshot.
- `/dashboard/admin/operations` shows recent audit, operational, and error
  events recorded by the app.
- `/dashboard/admin/data-quality` lets admins ignore, resolve, or reopen known
  data-quality issues.

Calendar feed tokens are redacted from exports. Existing legacy feed records may
still report that a plaintext token was present, but the token value is not
included.
