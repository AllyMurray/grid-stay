---
name: aws-deploy
description: Use for SST deployments, stage checks, and release verification in the Grid Stay repo. Triggers include requests to deploy `dev`, `staging`, or `prod`, check whether a stage is deployed, inspect AWS credential problems during SST deploys, or verify the deployed site. Default AWS profile for this repo is `personal` unless the user explicitly asks for another profile.
---

# Grid Stay Deploy

Use this skill for deploy and environment work in this repo.

Defaults:

- AWS profile: `personal`
- SST app stages: `dev`, `staging`, `prod`
- Region: `eu-west-1`

Workflow:

1. Confirm the requested stage and use `personal` unless the user explicitly names another profile.
2. Before deploying code changes, run the smallest relevant verification set. Prefer `pnpm build` and targeted tests if the changed area is known; use broader verification when risk is higher.
3. Deploy with SST using the explicit profile:
   - `AWS_PROFILE=personal npx sst deploy --stage <stage>`
4. Because deploys require network and AWS access, request escalated permissions when needed.
5. If SST reports missing credentials, check the active identity with:
   - `AWS_PROFILE=personal aws sts get-caller-identity`
6. If the deploy succeeds, report the stage and any surfaced site URL or stack output.
7. If the deploy fails, report the exact blocker and do not claim the stage was updated.

Guardrails:

- Do not switch away from `personal` unless the user explicitly asks.
- Treat `prod` as a real production deploy and report concrete outcomes.
- Do not assume a stage is currently deployed without checking SST or AWS output.
- Keep deployment commands explicit about stage; never rely on an implicit default stage in user-facing guidance.
