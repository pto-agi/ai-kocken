---
name: testing
description: How to write and run tests — Vitest setup, conventions, and the full test pipeline.
---

# Testing Skill

## Framework

- **Vitest** (v4) with Node environment
- Test files: `tests/*.test.ts` (43 test files)
- Config: `vite.config.ts` → `test.include: ['tests/**/*.test.ts']`

## Commands

```bash
npm run test:unit              # Run unit tests only
npm run test                   # Full pipeline: typecheck → lint → test:unit → build
npm run test:resend:live       # Live test for Resend email (requires RESEND_LIVE_TEST=1)
```

## Conventions

1. **File naming**: `[module].test.ts` matching the source module name
2. **Location**: All tests in `tests/` directory (flat, not co-located)
3. **Mocking**: Use Vitest's built-in mock utilities
4. **No browser tests**: Tests run in Node environment

## Test Categories

- **Utility tests**: Pure function tests (e.g., `agendaCompletionItems.test.ts`)
- **API tests**: Mock request/response testing (e.g., `formNotificationsApi.test.ts`)
- **Service tests**: Business logic tests (e.g., `geminiService.test.ts`)
- **Live tests**: External API integration tests (opt-in via env vars)

## Adding a New Test

1. Create `tests/[myModule].test.ts`
2. Import from the source module
3. Use `describe`/`it`/`expect` pattern
4. Run `npm run test:unit` to verify

## Lint

```bash
npm run lint     # ESLint on: api components pages store tests utils scripts App.tsx types.ts
```
