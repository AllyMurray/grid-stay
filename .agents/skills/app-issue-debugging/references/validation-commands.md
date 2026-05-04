# Validation Commands

Use the smallest command set that proves the bug and the fix.

## Focused Test Loop

Run the narrowest reproducer first:

```bash
pnpm exec vitest run <test-path>
```

For a few related tests, pass multiple paths instead of the whole suite.

## Package Checks

Use these after the reproducer goes green when the change reaches beyond a single helper:

```bash
pnpm run typecheck
pnpm exec biome check <changed-files>
```

## Full Repo Checks

Use only when the blast radius justifies it:

```bash
pnpm run test:run
pnpm run typecheck
pnpm run lint
```

## Browser And Runtime Validation

For issues that depend on browser behaviour, start the app locally or use the deployed site with the agent browser. Prefer an automated regression test first; use manual browser validation to confirm runtime edges, not as a substitute for the reproducer.

```bash
pnpm run dev
```
