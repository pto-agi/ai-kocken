---
name: openai_agent
description: How to build and modify the OpenAI Agent — tools, guardrails, conversation flow, and streaming.
---

# OpenAI Agent Skill

## Architecture

The chat agent is built using the **OpenAI Agents SDK** (`@openai/agents`) with these components:

- **Agent definition**: `services/agentWorkflow.ts` — creates the `PTOAi Support` agent
- **Chat API endpoint**: `api/chat.ts` — SSE streaming endpoint
- **Frontend widget**: `components/SupportChat.tsx` — React chat UI
- **Model**: `gpt-5-mini` (configurable via `AGENT_MODEL` env var)

## Agent Tools (Direct API)

All tools are defined in `services/directTools.ts` and wrapped in `services/agentWorkflow.ts`:

| Tool | Purpose |
|---|---|
| `todoist_create_task` | Create Todoist tasks (support tickets) |
| `todoist_find_project` | Find project by name |
| `todoist_find_task` | Search tasks |
| `todoist_add_comment` | Comment on tasks |
| `sheets_get_data` | Read Google Sheets data |
| `sheets_lookup_email` | Find client by email in Sheets |
| `sheets_get_info` | Get spreadsheet metadata |
| `file_search` | OpenAI file search (vector store) |

## Guardrails

Uses `@openai/guardrails` with jailbreak detection:

```typescript
const vaktenConfig = {
  guardrails: [{ name: 'Jailbreak', config: { model: 'gpt-4.1-mini', confidence_threshold: 0.7 } }],
};
```

Flow: Input → Guardrails check → If tripwire → return fail output. Otherwise → run agent.

PII and moderation guardrails are also supported via `runAndApplyGuardrails()`.

## Adding a New Tool

1. Create the API function in `services/directTools.ts`
2. Wrap it with `tool({...})` in `services/agentWorkflow.ts` 
3. Add to the `directTools` array
4. Update the agent instructions to reference the new tool

Example pattern:
```typescript
const myNewTool = tool({
  name: 'my_tool',
  description: 'Beskrivning på svenska för agenten',
  parameters: {
    type: 'object' as const,
    properties: { ... },
    required: [...],
    additionalProperties: false as const,
  },
  execute: async (input: any) => { ... },
});
```

## Streaming (SSE)

The chat endpoint (`api/chat.ts`) uses Server-Sent Events:

1. Client sends POST with `messages[]` + `access_token`
2. Server runs the agent workflow
3. Chunks are streamed via SSE events: `chunk`, `done`, `meta`, `error`
4. Messages are persisted to `chat_conversations` + `chat_messages` after completion

## Agent Instructions

Written in Swedish. Located in the `ptoaiSupportInstructions` function. Contains:
- Role definition (PTO Coach)
- Run books for common scenarios (exercise swaps, membership extensions, etc.)
- Tool usage instructions
- User context injection (name, email)

## Environment Variables

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | OpenAI API authentication |
| `AGENT_MODEL` | Override default model (default: `gpt-5-mini`) |
| `TODOIST_API_KEY` | Todoist API access |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Sheets auth |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google Sheets auth |
| `GOOGLE_SHEET_ID` | Default client data spreadsheet |
