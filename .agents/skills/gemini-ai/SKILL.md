---
name: gemini_ai
description: How to use and extend the Gemini AI integration for meal planning and structured generation.
---

# Gemini AI Skill

## Architecture

Gemini is used for **meal planning and recipe generation** via a server-side proxy:

- **Service**: `services/geminiService.ts` — all Gemini logic
- **API proxy**: `api/gemini.ts` — Vercel serverless function
- **Frontend**: `components/WeeklyPlanner.tsx` — meal planner UI
- **SDK**: `@google/genai` with structured JSON output

## How It Works

1. Frontend calls `callGemini()` which hits `/api/gemini`
2. The API proxies to Google's Generative AI API
3. Uses **structured output** via `responseMimeType: "application/json"` + `responseSchema`
4. Schema uses `Type` enum from `@google/genai` for strict JSON typing

## Key Functions

| Function | Purpose |
|---|---|
| `generateWeeklyPlan()` | Generate a full week meal plan with macro targets |
| `generateFullWeeklyDetails()` | Add ingredients + instructions to a plan |
| `swapMeal()` | Replace a single meal with an alternative |
| `generateRecipe()` | Generate a detailed recipe |
| `generateFullRecipe()` | Recipe with allergy context |

## Structured Output Pattern

```typescript
const config = {
  responseMimeType: "application/json",
  responseSchema: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        day: { type: Type.STRING },
        meals: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              kcal: { type: Type.NUMBER },
              // ...
            },
            required: ["name", "type", "kcal"]
          }
        }
      },
      required: ["day", "meals"]
    }
  }
};
const text = await callGemini(prompt, config);
const parsed = JSON.parse(text);
```

## Retry Logic

If Gemini returns wrong structure (wrong day/meal count), the service retries once with an explicit correction prompt.

## Normalization

All Gemini outputs are normalized through helper functions:
- `normalizeWeeklyMeal()` — handles varying field names (kcal/calories/energi, protein/p, etc.)
- `normalizeWeeklyDay()` — ensures day structure with totals
- `mergeWeeklyMeal()` — combines overview + detail passes

## Adding a New Gemini Feature

1. Add your function in `services/geminiService.ts`
2. Use `callGemini(prompt, config)` with appropriate schema
3. Always use `safeJsonParse()` for error-safe parsing
4. Add normalization if needed
5. Export and consume from your component

## Environment Variables

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key (server-side) |
| Via Vercel rewrite | `/api-proxy/` proxies to `generativelanguage.googleapis.com` |
