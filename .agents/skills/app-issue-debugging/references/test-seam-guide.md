# Test Seam Guide

Use the narrowest seam that can reproduce the bug honestly.

## Start Here

Ask:

1. Is the bug just data in, data out?
2. Does it depend on React lifecycle or async effects?
3. Does the user-visible symptom depend on rendered UI, alerts, or navigation?
4. Does it require multiple modules working together?

## Preferred Order

1. Pure unit test
2. Hook test
3. Screen test
4. Broader integration harness

Move down only when the seam above cannot reproduce the real failure.

## Examples

- Wrong billing label or error message: pure unit test.
- Hydration race, retry queue, notification permission state: hook test.
- Black error bar replaced by inline banner or alert: screen test.
- Login flow broken by interaction between auth state, router, and API result: screen test, plus lower-level tests if useful.
- Device-only failure from a native entitlement or OS integration: reproduce at the nearest hook or adapter seam, then guard the screen against the rejection.

## Anti-Patterns

- Writing an end-to-end style test when a helper test would reproduce the issue exactly.
- Mocking so much that the test only proves the mock setup.
- Fixing first and then writing assertions for the new behavior.
- Adding many adjacent tests before a single failing reproducer exists.
