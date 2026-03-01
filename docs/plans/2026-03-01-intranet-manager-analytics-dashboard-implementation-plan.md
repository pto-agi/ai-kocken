# Manager Analytics Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform `/intranet/manager` into a deterministic analysis dashboard with task time deltas, alarm classification, manager override capability, clickable section headers, and historical report/submission analysis.

**Architecture:** Introduce a pure analytics utility layer (`utils/managerAnalytics.ts`) that computes per-task expected vs actual timing, severity and summary KPIs over a selected date range. Wire the output into `pages/IntranetManager.tsx` with new interactive sections and optional persistence for alarm overrides.

**Tech Stack:** React 18, TypeScript, Supabase, Vitest, Vite.

---

### Task 1: Add Analytics Utility + Tests

**Files:**
- Create: `/Users/marcus/Desktop/ptoainew3-main/utils/managerAnalytics.ts`
- Create: `/Users/marcus/Desktop/ptoainew3-main/tests/managerAnalytics.test.ts`

**Step 1: Write failing tests**
- Add tests for expected time, delta/severity, missing tasks, manager override precedence.

**Step 2: Verify RED**
Run: `npm run test:unit -- tests/managerAnalytics.test.ts`
Expected: FAIL (missing module/logic)

**Step 3: Implement minimal analytics logic**
- Add pure functions for range analysis and summary rollups.

**Step 4: Verify GREEN**
Run: `npm run test:unit -- tests/managerAnalytics.test.ts`
Expected: PASS

### Task 2: Integrate Analysis Sections in Manager Page

**Files:**
- Modify: `/Users/marcus/Desktop/ptoainew3-main/pages/IntranetManager.tsx`

**Step 1: Add range/filter state + section expand state**
- Add interval controls (1/7/30), level filters, and clickable heading toggles.

**Step 2: Load range data and compute analytics**
- Reuse existing fetches and compute derived metrics via new utility.

**Step 3: Render new analysis UI blocks**
- KPI summary, delta table, historical reports explorer, submission analysis.

**Step 4: Keep existing daily operational drilldown compatible**
- Reuse existing cards and add new alert badges/details.

### Task 3: Manager Alarm Override (Optional Persistence)

**Files:**
- Modify: `/Users/marcus/Desktop/ptoainew3-main/pages/IntranetManager.tsx`
- Modify: `/Users/marcus/Desktop/ptoainew3-main/supabase/agenda_manager.sql`

**Step 1: Add override state and upsert handler**
- Track per-task override and reason in UI state.

**Step 2: Persist when table exists; fallback gracefully when missing**
- Attempt Supabase upsert/select; if missing table, continue with non-blocking UX.

**Step 3: Reflect final alarm decision in analysis + task cards**
- Show auto vs manager status clearly.

### Task 4: Verification and Stability

**Files:**
- Verify only: `/Users/marcus/Desktop/ptoainew3-main/pages/Changelog.tsx`
- Verify only: `/Users/marcus/Desktop/ptoainew3-main/data/changelog.json`

**Step 1: Run targeted test suites**
Run:
- `npm run test:unit -- tests/managerAnalytics.test.ts`
- `npm run test:unit -- tests/managerAgenda.test.ts tests/managerPerformance.test.ts`

**Step 2: Run full verification gate**
Run: `npm test`
Expected: typecheck + lint + tests + build pass.

**Step 3: Ensure changelog page still renders**
- Confirm build succeeds for `/changelog` path and no import/runtime issues.
