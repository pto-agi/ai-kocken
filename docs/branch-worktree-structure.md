# Branch And Worktree Structure (2026-03-01)

## Purpose

Keep Trainerize agent development isolated while continuing normal app/client/dashboard work safely.

## Active Lanes

1. Live lane
   - Branch: `main`
   - Path: `/Users/marcus/Desktop/ptoainew3-main`
   - Rule: publish/deploy from this lane only when release-ready.

2. App + dashboard lane
   - Branch: `codex/dashboard-mainline`
   - Path: `/Users/marcus/Desktop/ptoainew3-main/.worktrees/dashboard-mainline`
   - Rule: ongoing app/client/dashboard work happens here first, then merge to `main`.

3. Trainerize agent lane (isolated)
   - Branch: `codex/trainerize-hybrid-plan`
   - Path: `/Users/marcus/Desktop/ptoainew3-main/.worktrees/codex-trainerize-hybrid-plan`
   - Rule: do not merge to `main` until agent is explicitly approved for release.

4. Legacy dashboard plan lane (reference)
   - Branch: `codex/manager-dashboard-plan`
   - Path: `/Users/marcus/Desktop/ptoainew3-main/.worktrees/manager-dashboard-plan`
   - Rule: use as comparison/reference source when pulling over missing dashboard changes.

## Safety Check Before Release

Run this on the branch you plan to release:

```bash
git ls-tree -r --name-only HEAD | rg "^(api/trainerize/|services/trainerize/|pages/TrainerizeAgent.tsx|scripts/trainerize-runner.ts|scripts/local-api-server.ts)"
```

Expected for a non-agent release: no output.

## Daily Workflow

```bash
# App/client/dashboard work
cd /Users/marcus/Desktop/ptoainew3-main/.worktrees/dashboard-mainline

# Trainerize agent work
cd /Users/marcus/Desktop/ptoainew3-main/.worktrees/codex-trainerize-hybrid-plan

# Live/release checks
cd /Users/marcus/Desktop/ptoainew3-main
```

## Merge Policy

1. Merge app/dashboard work from `codex/dashboard-mainline` -> `main`.
2. Keep `codex/trainerize-hybrid-plan` separate until a dedicated agent release decision is made.
3. If needed, cherry-pick selected commits from `codex/manager-dashboard-plan` into `codex/dashboard-mainline` instead of merging that branch blindly.
