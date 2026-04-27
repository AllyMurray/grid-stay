# Admin Member Management Plan

Status: implemented.

This document captures the agreed plan for adding admin-only member management
so the work can be picked up cleanly in a new session.

## Goal

Add an admin area where Ally can:

- browse members
- open a member detail page
- view that member's bookings
- manage that member's series subscriptions

This should be available only to admin users. In practice, the current admin
check is driven by [app/lib/auth/authorization.ts](/Users/ally/Projects/repos/grid-stay/app/lib/auth/authorization.ts),
which currently whitelists `allymurray88@gmail.com`.

## Agreed UX

### Sidebar

Create a separate `Admin` section in the dashboard sidebar.

Admin-only items should live there:

- `Manual Days`
- `Member Management`

These items must only render when `isAdminUser(user)` is true.

### Public vs admin members

Do not mix admin management into the regular members area.

- Keep the regular member directory at `dashboard/members` if we still want a
  general site-members page.
- Put management routes under an explicit admin path:
  - `dashboard/admin/members`
  - `dashboard/admin/members/:memberId`

This keeps the boundary obvious in both the UI and the codebase.

### Member management pages

#### `dashboard/admin/members`

Purpose:

- searchable admin directory of members
- quick summaries
- click through to manage a specific member

#### `dashboard/admin/members/:memberId`

Purpose:

- show the selected member's upcoming bookings
- show current series subscriptions
- let an admin add the member to a series
- let an admin change subscription status between `booked` and `maybe`
- let an admin remove a subscription

Desktop layout:

- page header and summary at the top
- bookings list as the main working surface
- admin controls in a separate panel

Mobile layout:

- stacked full-width sections
- avoid dense split-view patterns

## Permissions

### Route protection

All admin member-management routes should use `requireAdmin(request)`.

Non-admin behavior:

- sidebar items are hidden
- direct navigation returns `403`

### Visibility of booking fields

The member detail page should not expose private booking data.

Show:

- date
- circuit
- provider
- description
- status
- shared accommodation name

Do not show:

- booking reference
- accommodation reference
- notes

## Data model and service approach

No schema migration is required for the first pass.

The repo already has the right primitives:

- bookings
- series subscriptions
- series key/name derivation
- add-series behavior that already creates missing bookings

Relevant existing files:

- [app/lib/db/services/series-subscription.server.ts](/Users/ally/Projects/repos/grid-stay/app/lib/db/services/series-subscription.server.ts)
- [app/lib/bookings/actions.server.ts](/Users/ally/Projects/repos/grid-stay/app/lib/bookings/actions.server.ts)
- [app/lib/days/series.server.ts](/Users/ally/Projects/repos/grid-stay/app/lib/days/series.server.ts)

### New service work

Add a member profile loader that:

- loads the auth user by `memberId`
- loads that user's bookings
- loads that user's series subscriptions
- returns a safe page view model

Add series subscription service helpers for:

- `listByUser(userId)`
- `delete(userId, seriesKey)`

### Series assignment behavior

When an admin adds a member to a series:

1. resolve the target series from the combined available-day set
2. upsert the member's series subscription
3. add only the missing bookings for that series
4. preserve any existing bookings and their existing private fields

This should reuse the same logic and expectations as the current user-facing
series-add flow.

### Series removal behavior

When an admin removes a series subscription:

- remove the subscription record
- do not automatically delete that member's existing bookings

This is the safer default and avoids destructive surprises.

## Presentational pattern

Follow the existing route/page split already used in this repo:

- route module handles auth, loader, action, redirects, and prop wiring
- page module handles Mantine UI and presentation

Use the same pattern as:

- [app/routes/dashboard/members.tsx](/Users/ally/Projects/repos/grid-stay/app/routes/dashboard/members.tsx)
- [app/pages/dashboard/members.tsx](/Users/ally/Projects/repos/grid-stay/app/pages/dashboard/members.tsx)
- [app/routes/dashboard/manual-days.tsx](/Users/ally/Projects/repos/grid-stay/app/routes/dashboard/manual-days.tsx)

## Recommended route structure

Add routes:

- `app/routes/dashboard/admin.members.tsx`
- `app/routes/dashboard/admin.members.$memberId.tsx`

Or, if preferred for consistency with folder naming:

- `app/routes/dashboard/admin/members.tsx`
- `app/routes/dashboard/admin/members.$memberId.tsx`

Update [app/routes.ts](/Users/ally/Projects/repos/grid-stay/app/routes.ts)
to register those admin routes.

## Recommended page modules

Add page modules:

- `app/pages/dashboard/admin-members.tsx`
- `app/pages/dashboard/admin-member-detail.tsx`

These should use existing layout primitives where possible:

- `PageHeader`
- `HeaderStatGrid`
- `EmptyStateCard`
- `shell-card`

## Suggested implementation order

1. Add an `Admin` nav section in the dashboard layout.
2. Move `Manual Days` into that section.
3. Add admin routes for member management.
4. Add member profile loader/service code.
5. Add series subscription `listByUser` and `delete`.
6. Build the admin members list page.
7. Build the admin member detail page.
8. Add admin actions for add/update/remove series subscriptions.
9. Add tests for route protection, page rendering, and subscription behavior.

## Test coverage to add

### Navigation and auth

- admin nav section renders only for admins
- non-admin users cannot load admin member routes

### Admin members list

- member list renders
- search filters correctly
- rows link to the detail page

### Admin member detail

- selected member summary renders
- bookings render without private fields
- current subscriptions render

### Actions

- adding a series creates or updates the subscription
- adding a series backfills only missing bookings
- existing bookings are preserved
- removing a series deletes the subscription only
- changing subscription status updates the record

## Explicit non-goals for the first pass

Do not include these in the initial implementation:

- role editing
- email or identity management
- editing another member's private booking references or notes
- bulk deletion of a member's bookings when removing a series

Those are separate admin concerns and should not be coupled to the first member
management release.
