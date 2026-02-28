# Trainerize Hybrid Agent Design

Date: 2026-02-26
Owner: Marcus + Codex
Status: Draft

## Summary
Build a hybrid automation system for Trainerize where the most stable actions run via MCP/Zapier integrations and missing actions are performed by a controlled web agent in a browser. Start with a narrow pilot: open a client profile, open a specific workout, edit it, and replace one exercise with another. Early versions are human-in-the-loop before any save actions.

## Goals
- Reduce manual workload while keeping client risk low.
- Deliver a stable, verifiable web-agent flow for "replace exercise" in a workout.
- Create clear auditability and control checkpoints.
- Support gradual expansion toward more automation.

## Non-Goals
- Full migration off Trainerize.
- Fully autonomous edits without review from day one.
- Broad automation across all Trainerize features in the first release.

## Assumptions
- A dedicated test account is available in Trainerize.
- Login uses email/password with no 2FA, and automation is allowed.
- Some Trainerize actions are available through MCP/Zapier.

## Approach Options Considered
1. Web-agent only.
2. Hybrid: MCP/Zapier for supported actions, web-agent for gaps. (Chosen)
3. Build a standalone app and migrate clients.

## Architecture
- **Orchestrator**
  - Accepts automation tasks with structured inputs.
  - Decides whether to execute via MCP/Zapier or web agent.
  - Enforces policy checks before any write action.
- **Web Agent (Browser Automation)**
  - Runs in a controlled browser session.
  - Navigates to client profile, selects workout, edits workout, replaces exercise.
  - Captures evidence at key steps (screenshots/DOM snapshots).
- **Verification Layer**
  - Confirms client identity, workout date, and target exercise before edit.
  - Generates a diff summary of the proposed change.
- **Human Checkpoint**
  - Required approval before the final save in early phases.
- **Audit & Logging**
  - Step-by-step logs with timestamps, failure reasons, and artifacts.

## Data Flow
1. Input arrives: client identifier, workout date, replace exercise A with B.
2. Orchestrator checks if an API path exists. If not, route to web agent.
3. Web agent logs in, navigates to client, opens workout, enters edit mode.
4. Verification layer checks visible labels and exercise details.
5. Agent stages replacement and produces a change summary.
6. Human approves or rejects. Only then does the agent save changes.
7. Result stored with evidence artifacts.

## Guardrails
- Abort if client name, workout date, or target exercise mismatch.
- No automatic retries for save actions.
- Only retry safe navigation steps (loading, back/forward, search).
- All actions limited to test account during pilot.

## Observability
- Per-run log with step timing, status, and errors.
- Artifacts: screenshots and DOM snapshots at key points.
- Metrics: success rate, abort rate, manual intervention rate.

## Rollout Plan
1. Validate flow on test account with fixed example tasks.
2. Expand to small, low-risk real client set with mandatory approvals.
3. Review stability, then widen scope to more actions.

## Testing
- Scripted end-to-end tests in the test account.
- UI change detection by checking key selectors and fallback logic.
- Negative tests for mismatched client or workout.

## Risks
- Trainerize UI changes break selectors.
- Latency or partial page loads cause missed elements.
- Human approval delays could slow workflow.

## Open Questions
- Which specific actions are already supported via MCP/Zapier?
- What evidence format is preferred for audit (images, logs, or both)?
- How should approvals be collected (Slack, email, internal UI)?
