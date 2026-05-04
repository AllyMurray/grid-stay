---
name: app-issue-debugging
description: Reproduce and fix bugs reported in the Grid Stay app with a test-first workflow. Use when a user reports a UI bug, runtime error, broken flow, failed API interaction, regression, or flaky behavior. Debug only enough to understand the failure and choose the right test seam, then write a failing test first, implement the fix, rerun the test green, and finish with targeted validation and residual-risk notes.
---

# App Issue Debugging

Follow this workflow whenever the user reports a product bug.

## Defaults

- Treat the report as true until disproved, but verify the exact symptom before changing code.
- Prefer the smallest repro that still exercises the real failure.
- Prefer the highest-fidelity automated test the codebase can support without turning the fix into a testing project.
- Do not fix first and retrofit the test later.
- Do not close the task on manual confidence alone when an automated regression test is practical.

## Workflow

1. Capture the failure.
   - Restate the symptom in one sentence.
   - Identify the affected surface, trigger, and expected behavior.
   - Gather the minimum evidence needed: logs, screenshots, stack traces, exact copy, route, account state, device mode, mock/live mode, and whether the issue is deterministic.

2. Debug just enough to place the test.
   - Read the relevant code path.
   - Trace inputs, async boundaries, and error handling.
   - Decide the narrowest seam that can reproduce the issue:
     - Pure function or parser: unit test.
     - Hook or store behavior: hook test.
     - Screen logic, alerts, retries, inline errors: screen test.
     - Cross-screen or native/device behavior that cannot be isolated meaningfully: use the closest regression harness available and document the gap.

3. Write the reproducer before the fix.
   - Create or update a test that fails for the reported bug.
   - Use synthetic fixtures; do not paste raw external payloads or secrets.
   - Make the failure specific enough that a future regression is obvious from the assertion text.

4. Confirm the test fails for the right reason.
   - Run the new test before changing production code.
   - If it passes, the repro is wrong. Refine the understanding and test until it fails on the current code.

5. Implement the smallest defensible fix.
   - Fix the root cause when it is reasonably reachable.
   - Add defensive guards for operational failures that should never leak to users as uncaught errors.
   - Prefer user-facing fallback states over console noise for recoverable product failures.
   - Keep the change close to the failing path; avoid broad refactors unless the root cause demands one.

6. Prove it.
   - Rerun the failing test and confirm it goes green.
   - Run nearby tests and the smallest additional validation set justified by risk.
   - If the issue was caused by async rejection, error boundaries, native module failures, or environment drift, validate those edges explicitly.

7. Report the result.
   - State root cause in plain language.
   - List the test added or updated.
   - Note what was validated.
   - Call out residual risk or untestable edges.

## Test-Seam Heuristics

- Choose a pure unit test when the bug is in mapping, formatting, branching, validation, or error-message selection.
- Choose a hook test when the bug is in effect timing, derived state, subscriptions, hydration, or queued async work.
- Choose a screen test when the bug is visible in CTA state, alerts, banners, retries, navigation decisions, or rendered copy.
- Choose a broader integration path only when the failure depends on coordination across modules and cannot be reproduced honestly lower down.

Read [references/test-seam-guide.md](references/test-seam-guide.md) when the right seam is unclear.
Read [references/validation-commands.md](references/validation-commands.md) when you need the usual test and validation commands for this repo.

## Grid Stay Production Diagnostics

- Use `AWS_PROFILE=personal` for production inspection unless the user explicitly says otherwise.
- The production site Lambda log group is `/aws/lambda/grid-stay-server-prod`; the available-days refresh function logs separately under `/aws/lambda/gridstay-prod-RefreshAvailableDaysCacheFunction-*`.
- The production app DynamoDB table is `grid-stay-prod`.
- Not every product failure appears as a CloudWatch `ERROR`; some route actions catch recoverable failures and write app-event records instead.
- For feedback update reports, check all three surfaces before assuming the request failed:
  - CloudWatch site Lambda logs for uncaught route/action errors.
  - App events in DynamoDB: `feedback.update.saved` for successful updates, `feedback.update.email.failed` for SES/send failures, and `category = error` for recorded product errors.
  - The feedback record itself; `adminUpdatesJson`, `status`, and `updatedAt` are the source of truth for whether the update saved.

## Rules For Hard Cases

- If the reported bug cannot be reproduced automatically with reasonable effort, say so explicitly and add the best available regression harness anyway.
- If the fix must land before a perfect repro exists, add the strongest partial test you can and explain the remaining gap.
- If existing dirty-worktree changes touch the same area, work with them carefully and avoid reverting unrelated edits.
- If the failure is caused by a missing catch, unhandled promise, native API rejection, or failed external link, treat that as a product bug even when the underlying service is flaky.

## Grid Stay Preferences

- For app issues, start by checking whether the bug belongs in a pure helper, a hook, or a screen before reaching for broader device-level debugging.
- For API-driven failures, prefer the repo's existing result-shape patterns and targeted user-facing copy over generic exceptions.
