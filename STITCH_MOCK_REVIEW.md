# Stitch Mock Review

This document captures the review of the two Google Stitch mock directories in
`.ideas/` and turns them into concrete product and UI ideas for Grid Stay.

## Sources Reviewed

### 1. `stitch_caterham_event_planner`

Primary references:

- `.ideas/stitch_caterham_event_planner/apex_precision/DESIGN.md`
- `.ideas/stitch_caterham_event_planner/my_bookings_desktop/code.html`
- `.ideas/stitch_caterham_event_planner/my_bookings_mobile/code.html`
- `.ideas/stitch_caterham_event_planner/group_attendance_desktop/code.html`
- `.ideas/stitch_caterham_event_planner/group_attendance_mobile/code.html`
- `.ideas/stitch_caterham_event_planner/accommodation_view_desktop/code.html`
- `.ideas/stitch_caterham_event_planner/accommodation_view_mobile/code.html`
- `.ideas/stitch_caterham_event_planner/add_edit_booking_desktop/code.html`
- `.ideas/stitch_caterham_event_planner/add_edit_booking_mobile/code.html`
- `.ideas/stitch_caterham_event_planner/sign_in_desktop/code.html`
- `.ideas/stitch_caterham_event_planner/sign_in_mobile/code.html`

Core character:

- editorial paddock feel
- technical and private/shared coordination language
- denser operational layout
- stronger distinction between private data and shared team data

### 2. `stitch_paddock_days_ui`

Primary references:

- `.ideas/stitch_paddock_days_ui/paddock_editorial/DESIGN.md`
- `.ideas/stitch_paddock_days_ui/available_days_desktop/code.html`
- `.ideas/stitch_paddock_days_ui/available_days_mobile/code.html`
- `.ideas/stitch_paddock_days_ui/day_detail_desktop/code.html`
- `.ideas/stitch_paddock_days_ui/my_bookings_desktop/code.html`
- `.ideas/stitch_paddock_days_ui/booking_edit_desktop/code.html`
- `.ideas/stitch_paddock_days_ui/add_booking_modal_desktop/code.html`
- `.ideas/stitch_paddock_days_ui/login_desktop/code.html`

Core character:

- track-day operations tool
- sharper list/detail hierarchy
- stronger event-card and day-detail patterns
- more assertive filter and feed structure

## High-Level Conclusion

The strongest ideas split cleanly:

- `stitch_paddock_days_ui` is the better source for `Available Days`
  information architecture.
- `stitch_caterham_event_planner` is the better source for `My Bookings`,
  accommodation coordination, and private/shared data cues.

The current Grid Stay app already has the right route split:

- `/dashboard`
- `/dashboard/days`
- `/dashboard/bookings`

But the mocks suggest that the current UI still compresses some important
coordination tasks into generic cards, table columns, and helper text instead
of letting them become first-class workflows.

## Current App Seams

Relevant files in the current app:

- `app/routes.ts`
- `app/routes/_dashboard.tsx`
- `app/pages/dashboard/index.tsx`
- `app/pages/dashboard/days.tsx`
- `app/pages/dashboard/bookings.tsx`
- `app/pages/auth/login.tsx`
- `app/pages/home.tsx`

## Best Ideas to Reuse

### 1. Rework Available Days into a list/detail tool

Current state:

- `app/pages/dashboard/days.tsx` still presents the core experience as a wide
  table with one compressed "Group plan" column.

What the mocks do better:

- event cards feel selectable
- each event has stronger identity
- the detail view is where the group context lives

Recommendation:

- mobile: stacked event cards
- desktop: event list on the left, selected-day detail panel on the right
- detail panel should contain:
  - date and type
  - provider
  - description
  - attendee count
  - shared accommodation summary
  - add/manage booking action

Why this matters:

- the current table is efficient for scanning but weak for decision-making
- the mocks are better at making each day feel like a real planning object

### 2. Make group coordination a first-class workflow

Current state:

- group coordination is mostly summary data inside `/dashboard/days`
- the current app has no dedicated route or major surface for accommodation and
  attendance planning beyond summaries

What the mocks do better:

- attendance and lodging are treated as the main collaboration surface
- accommodation is visible as a planning object, not just text inside a row

Recommendation:

- either add a richer selected-day detail panel inside `/dashboard/days`
- or add a dedicated route such as `dashboard/stays`

That surface should show:

- attendees
- current statuses
- accommodation options or current shared stay
- visible separation between private and shared information

### 3. Put private/shared meaning directly on booking fields

Current state:

- `app/pages/dashboard/bookings.tsx` explains privacy below the fields
- the distinction is conceptually correct but visually understated

What the mocks do better:

- private and shared fields feel different at the point of interaction
- the user understands visibility before reading explanatory copy

Recommendation:

- add lock/team or lock/shared icons in labels
- split the edit form into clearly named sections
- give private and shared zones subtly different surface treatments
- keep field-level helper text short and explicit

Example improvements:

- `Booking reference` -> lock icon + "Only visible to you"
- `Accommodation name` -> team/shared icon + "Visible to the group"
- `Accommodation reference` -> lock icon + private treatment

### 4. Make the overview page feel operational, not generic

Current state:

- `app/pages/dashboard/index.tsx` is cleaner now, but still reads as a good
  dashboard skeleton rather than a strong motorsport planning board

What the mocks do better:

- they create a sense of active season context
- they frame the next decision instead of just summarizing the app

Recommendation:

- orient the page around the next race/test/track decision
- emphasize one "next action" block
- show a "crew readiness" or "trip readiness" view instead of generic summary
  panels

Potential structure:

- next event block
- your booking state block
- shared accommodation convergence block
- outstanding decisions block

### 5. Upgrade the login screen framing

Current state:

- `app/pages/auth/login.tsx` is functional and fast
- it is still basically a redirect loader with a retry button

What the mocks do better:

- they frame the app as a serious, specific coordination tool
- they make trust and purpose clearer before sign-in

Recommendation:

- keep Google-only auth
- keep the redirect behavior
- but improve the login page copy and layout so it communicates:
  - what Grid Stay coordinates
  - what remains private
  - why the user is being sent to Google

Important:

- do not copy fake telemetry/authentication jargon
- do not add fake security theater

### 6. Add an accommodation-focused view

Current state:

- accommodation is visible inside bookings and summaries
- there is no dedicated accommodation planning view

What the mocks do better:

- shared stays are treated as their own planning domain
- the user can understand where the group is converging

Recommendation:

- add an accommodation-focused subview or route
- show:
  - current shared stay by event
  - how many people are staying there
  - unassigned trips
  - suggested alternatives or edits

This could live as:

- a tab inside bookings
- a panel inside a day detail surface
- or a dedicated `dashboard/stays` route

## Visual Patterns Worth Borrowing

### From `stitch_caterham_event_planner`

Good ideas:

- stronger private/shared cues
- more editorial section naming
- clearer operational hierarchy for booking details
- accommodation treated as a planning object, not metadata

Use carefully:

- denser, more technical presentation
- more explicit coordination framing

### From `stitch_paddock_days_ui`

Good ideas:

- available-days card rhythm
- day detail panel
- stronger event identity
- more useful list/detail behavior for desktop and mobile

Use carefully:

- sharper and more structured information density
- stronger filter framing without turning the app into a control panel

## What Not to Copy

These mock patterns are not a good fit for Grid Stay as-is:

- fake telemetry language such as "export telemetry", "latency", or "sector"
  metaphors when there is no real telemetry product feature
- email/password login from `stitch_paddock_days_ui`
- zero-radius-everywhere brutalism
- excessive technical decoration
- fake status indicators that do not correspond to real app state
- giant side rails full of filter chrome that add noise more than clarity

## What the Current App Already Gets Right

These should be preserved:

- route split between overview, available days, and bookings
- the two-pane direction on `My Bookings`
- recent shell cleanup and reduced card clutter
- compact header summary treatment
- Google-only sign-in flow

## Recommended Next Steps

### Highest value

1. Redesign `/dashboard/days` around a selectable event list with a selected-day
   detail panel.
2. Add stronger private/shared styling inside `/dashboard/bookings`.

### Second wave

3. Reframe `/dashboard` as a next-action operational overview.
4. Add an accommodation-focused planning surface.

### Third wave

5. Improve the sign-in screen framing.
6. Tighten the landing page so it feels more like a motorsport planning product
   and less like a general SaaS homepage.

## Proposed Implementation Order

If this work is executed in the app, the safest order is:

1. `app/pages/dashboard/days.tsx`
2. `app/pages/dashboard/bookings.tsx`
3. `app/pages/dashboard/index.tsx`
4. `app/pages/auth/login.tsx`
5. optional new route for stays/accommodation

## Final Recommendation

If only one direction is chosen:

- use `stitch_paddock_days_ui` as the structural model for `Available Days`
- use `stitch_caterham_event_planner` as the conceptual model for private/shared
  booking management

That combination fits Grid Stay better than copying either mock set whole.
