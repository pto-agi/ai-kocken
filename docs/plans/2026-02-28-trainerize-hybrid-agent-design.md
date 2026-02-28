# Trainerize Hybrid Agent Design (V2)

Date: 2026-02-28
Owner: Marcus + Codex
Status: Draft

## Summary
Build a hybrid automation system for Trainerize. When an action is not available via API/MCP, a controlled web agent performs it in the browser. The first pilot flow replaces an exercise in all matching workouts for a client, with human-in-the-loop approval before any save. The agent can reason about a “good” replacement using an LLM, but must select an existing Trainerize library exercise and follow strict verification gates.

## Goals
- Deliver a robust, auditable web-agent flow for “replace exercise” in Trainerize.
- Support LLM reasoning for exercise replacement with explicit guardrails.
- Keep client risk low via checkpoints, diff summaries, and manual approval.
- Be portable to Render later (separate config and runtime).

## Non-Goals
- Fully autonomous edits in the first release.
- Creating custom exercises in Trainerize.
- Broad automation across all Trainerize features in the first release.

## Assumptions
- Test account available in Trainerize.
- Login uses email + password (no 2FA for now).
- Local runtime first; later deployable to Render with minimal changes.

## Architecture
- **Local Web UI (Trigger)**
  - A small local form: `client email` + free-text request (e.g., “replace bench press”).
  - Shows LLM interpretation + confidence before running.
- **Orchestrator**
  - Validates inputs and logs a structured `TaskSpec`.
  - Chooses API/MCP route if supported, otherwise web agent.
  - Enforces policy checks before any write.
- **Web Agent (Playwright)**
  - Controlled browser session; navigates to client profile and workouts.
  - Captures artifacts at each key step.
- **Verification Layer**
  - Confirms correct client, workout context, and target exercise before edit.
  - Produces a per-pass diff and a global diff before save.
- **LLM Reasoning Layer**
  - Proposes replacement based on muscle group + client notes (injuries/limitations).
  - Emits short rationale + confidence score.
- **Human Checkpoint**
  - Terminal `Y/N` approval before any save.
- **Audit & Logs**
  - Structured logs + screenshots + DOM snapshots.

## Data Flow
1. **Input**: user enters `client email` + free text request.
2. **LLM parsing**: free text → structured intent (target exercise, muscle group signal, confidence).
3. **Orchestrator**: logs task and routes to web agent if no API path exists.
4. **Login & client lookup**: open client profile by email.
5. **Checkpoint 1**: verify client identity (name/email). Abort on mismatch.
6. **Muscle-group filter**: identify muscle group of target exercise.
7. **Workout selection**: open workouts that train the same muscle group.
8. **Exercise search**: locate the target exercise in **all** matching workouts.
9. **LLM proposal per workout**: generate replacement + rationale from client notes.
10. **Library search**: search Trainerize library; auto-pick top near-match; warn on low similarity.
11. **Checkpoint 2**: show per-workout diffs + global diff + confidence.
12. **Human gate**: terminal `Y/N`.
13. **Save**: only if approved.
14. **Artifacts & logs**: persist screenshots + DOM snapshots and structured logs.

## Replacement Logic (LLM)
- **Constraints**:
  - Same muscle group as target exercise.
  - Must respect client notes (injuries/limitations).
  - Must map to an existing Trainerize library exercise.
- **Behavior**:
  - Generates a short rationale.
  - If notes are missing/unclear → mark `low confidence` and require explicit approval.

## Library Search & Near Matching
- Use the LLM suggestion as the search term.
- Retrieve top N results (e.g., 5).
- Compute a simple similarity score on names.
- Auto-select the top match but:
  - Show alternatives in the diff summary.
  - Raise `low confidence` if similarity is weak.
- Never create custom exercises.

## Guardrails
- Abort if:
  - Client identity mismatch.
  - Target exercise not found in any candidate workout.
  - Critical UI selectors missing or layout deviates.
- Retry only safe steps (navigation/load/search), never save actions.
- Any `low confidence` requires explicit approval.

## Manual Checkpoint
- Terminal prompt before save.
- If low confidence: require stronger confirmation (e.g., `type YES`).

## Observability
- Run ID per job.
- Step timing, result, and reason codes.
- Artifacts per step: screenshots + DOM snapshots.
- Metrics: success rate, abort rate, low-confidence rate, manual intervention rate.

## Testing
- Scripted E2E tests on test account.
- Negative tests for mismatched client, missing exercise, and UI deviations.
- Selector “health check” to detect UI breakages early.

## Rollout
1. Test account only with fixed example tasks.
2. Small, low-risk real clients with mandatory approval.
3. Expand coverage based on stability metrics.

## Render Readiness
- Keep runtime configuration separate (login, base URL, selectors).
- Ensure artifacts/logs can be redirected to external storage.
- Avoid environment-specific assumptions (paths, local-only secrets).

## Open Questions
- Preferred storage backend for artifacts when running on Render.
- How to surface approvals beyond terminal (future UI/Slack workflows).
