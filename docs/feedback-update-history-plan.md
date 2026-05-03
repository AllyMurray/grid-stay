# Feedback Update History Follow-Up Plan

Status: planned after the feedback controls merge request.

The feedback controls MR adds member-visible feedback history, admin status
management, admin update messages, and member email notifications. To keep that
MR production-safe, admin updates remain stored on the feedback record as
`adminUpdatesJson` for now.

That storage shape is acceptable for low-volume single-admin use, but it can
lose an update if two admins send updates to the same feedback item at the same
time. A later release should move admin update history to append-only records
without breaking existing production data.

## Goal

Store each admin feedback update as its own durable record while keeping the
current member and admin UI behavior unchanged.

The follow-up should:

- preserve all existing `adminUpdatesJson` history
- prevent concurrent admin replies from overwriting each other
- keep status updates and feedback update history consistent
- include feedback update records in admin exports
- support rollback during rollout

## Recommended Data Model

Add a new `FeedbackUpdateEntity`.

Recommended attributes:

- `feedbackId`
- `updateId`
- `status`
- `message`
- `createdAt`
- `authorUserId`
- `authorName`

Recommended primary index:

- `pk`: `feedbackId`
- `sk`: `createdAt`, `updateId`

This lets the app list updates for one feedback item in chronological order and
append a new update without re-writing the whole feedback item.

## Production-Safe Rollout

### 1. Add The New Entity Without Removing The Old Field

Add `FeedbackUpdateEntity` and service helpers for:

- creating an update
- listing updates by `feedbackId`
- deleting updates by `feedbackId`

Keep `FeedbackEntity.adminUpdatesJson` in place.

### 2. Read From New Records With JSON Fallback

Change `listRecentFeedback`, `listMyFeedback`, and any direct feedback thread
loaders to assemble `FeedbackThread.adminUpdates` from `FeedbackUpdateEntity`.

If no update records exist for a feedback item, fall back to parsing
`adminUpdatesJson`.

This means the app can deploy before the backfill runs.

### 3. Write New Updates As Separate Records

Change `sendFeedbackUpdate` so it creates a new update record and updates the
parent feedback record status.

Use a DynamoDB transaction if practical, so the update record and parent status
change succeed or fail together.

If rollback safety is important for the first release, dual-write the JSON field
for one deploy while reads prefer the new records.

### 4. Include Updates In Admin Export

Update `/dashboard/admin/export` so exports include the new feedback update
records as their own collection.

This keeps production recovery complete if feedback history needs to be restored
from an export.

### 5. Backfill Existing JSON Updates

Add an idempotent script that:

1. scans feedback records with `adminUpdatesJson`
2. parses the stored update list
3. writes missing `FeedbackUpdateEntity` records
4. skips updates that already exist by `feedbackId` and `updateId`
5. reports counts for scanned records, created update records, skipped update
   records, and parse failures

Run the script once after the additive release is deployed.

### 6. Remove The Fallback Later

After one stable release with the backfill completed:

- stop reading `adminUpdatesJson`
- stop dual-writing `adminUpdatesJson`, if dual-writing was enabled
- remove the field from the feedback entity model

Do not remove the field in the same release that introduces the new entity.

## Delete Behavior

`deleteFeedback` should delete both the parent feedback item and all child update
records.

If a transaction is practical, use it. Otherwise, delete update records after
loading them and surface/log partial failures so orphaned records can be
repaired.

## Test Coverage

The follow-up should include tests for:

- listing feedback with update records
- falling back to `adminUpdatesJson` before backfill
- sending an update creates a child record and updates parent status
- two sequential updates are both preserved
- delete removes child update records
- admin export includes feedback update records
- backfill is idempotent

## Rollback Notes

The safest first deploy is additive. If the new read path has to be rolled back,
the old JSON field is still available.

If the first release dual-writes JSON and update records, rollback preserves the
old UI behavior. If the first release only writes update records, rollback may
hide updates created after that deploy until the new code is restored.
