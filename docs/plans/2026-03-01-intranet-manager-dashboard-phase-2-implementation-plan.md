# Intranet Manager Dashboard Phase 2 Implementation Plan

**Goal:** Implement manager-side agenda corrections (toggle complete/incomplete per person/task/day) with full audit trail so operations can be corrected from `/intranet/manager` and reflected in staff views.

**Architecture:** Reuse existing `agenda_completion_items` + `agenda_completions` dual-write model. Add explicit manager-write RLS policies for cross-user updates, extend the completion action helper to support an actor different from target user, and add a manager toggle flow in `IntranetManager.tsx` that writes both tables in one controlled path.

**Tech Stack:** React 18, TypeScript, Supabase (RLS), Vitest, Vite.

---

### Task 1: Completion Action Helper Supports Manager Actor

**Files:**
- Modify: `/Users/marcus/Desktop/ptoainew3-main/utils/agendaCompletionItems.ts`
- Modify: `/Users/marcus/Desktop/ptoainew3-main/tests/agendaCompletionItems.test.ts`

**Step 1: Write the failing test**

Add a test case in `tests/agendaCompletionItems.test.ts`:

```ts
it('uses actorUserId as completed_by for manager writes', () => {
  const action = buildCompletionItemAction({
    wasChecked: false,
    userId: 'staff-user',
    actorUserId: 'manager-user',
    reportDate: '2026-03-01',
    taskId: 'task-1',
    source: 'manager'
  });

  expect(action.type).toBe('insert');
  if (action.type === 'insert') {
    expect(action.payload.user_id).toBe('staff-user');
    expect(action.payload.completed_by).toBe('manager-user');
    expect(action.payload.source).toBe('manager');
  }
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/agendaCompletionItems.test.ts`  
Expected: FAIL because `actorUserId` is not supported yet.

**Step 3: Write minimal implementation**

Update `buildCompletionItemAction` input shape:

```ts
type Input = {
  wasChecked: boolean;
  userId: string;
  actorUserId?: string;
  reportDate: string;
  taskId: string;
  source?: 'staff' | 'manager';
};
```

Use actor fallback:

```ts
const actorId = input.actorUserId ?? input.userId;
```

Set payload:

```ts
completed_by: actorId
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/agendaCompletionItems.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/marcus/Desktop/ptoainew3-main/utils/agendaCompletionItems.ts \
  /Users/marcus/Desktop/ptoainew3-main/tests/agendaCompletionItems.test.ts
git commit -m "feat: support manager actor in completion item helper"
```

---

### Task 2: Add Manager Write Policies for Completion Tables

**Files:**
- Modify: `/Users/marcus/Desktop/ptoainew3-main/supabase/agenda_manager.sql`

**Step 1: Add missing manager write policies for `agenda_completions`**

Ensure manager can create missing row for user/day:

```sql
drop policy if exists agenda_completions_insert_manager on public.agenda_completions;
create policy agenda_completions_insert_manager on public.agenda_completions
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );
```

**Step 2: Add missing manager write policies for `agenda_completion_items`**

Allow manager inserts for other users:

```sql
drop policy if exists agenda_completion_items_insert_manager on public.agenda_completion_items;
create policy agenda_completion_items_insert_manager on public.agenda_completion_items
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );
```

Allow manager delete when unchecking task:

```sql
drop policy if exists agenda_completion_items_delete_manager on public.agenda_completion_items;
create policy agenda_completion_items_delete_manager on public.agenda_completion_items
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_manager = true)
  );
```

**Step 3: Commit**

```bash
git add /Users/marcus/Desktop/ptoainew3-main/supabase/agenda_manager.sql
git commit -m "feat: add manager write policies for completion overrides"
```

---

### Task 3: Implement Manager Task Toggle in `/intranet/manager`

**Files:**
- Modify: `/Users/marcus/Desktop/ptoainew3-main/pages/IntranetManager.tsx`
- Optional helper extraction: `/Users/marcus/Desktop/ptoainew3-main/utils/managerAgenda.ts`

**Step 1: Add local pending/error state for per-task overrides**

In `IntranetManager.tsx`, add:

```ts
const [taskMutationState, setTaskMutationState] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});
```

Key format:

```ts
const key = `${userId}:${dateKey}:${taskId}`;
```

**Step 2: Add handler `handleManagerToggleTask`**

Requirements:
- Inputs: `userId`, `taskId`, `isCurrentlyCompleted`
- Build action with `buildCompletionItemAction({ ..., source: 'manager', actorUserId: profile.id })`
- Insert/delete `agenda_completion_items`
- Update `agenda_completions.completed_task_ids` by reading current row and writing next array
- Always set `updated_at` and `updated_by` on `agenda_completions`
- Refresh local UI state (`completionItems`) optimistically after success

**Step 3: Wire button in task rows**

Add a button per task row:

```tsx
<button type="button" onClick={() => handleManagerToggleTask(member.id, task.task_id, task.is_completed)}>
  {task.is_completed ? 'Angra' : 'Markera klar'}
</button>
```

Disable while saving, show inline error on failure.

**Step 4: Verify manager/source marker**

In UI badge, show `Manager` when completion source is manager (derive from completion item record source).

**Step 5: Manual verification**

Run: `npm run dev`  
Verify:
- Manager can mark task complete for staff.
- Manager can unmark task.
- Manager can add new tasks for staff.
- Staff daily agenda reflects manager update after refresh.
- Completion row has `updated_by = manager_id`.

**Step 6: Commit**

```bash
git add /Users/marcus/Desktop/ptoainew3-main/pages/IntranetManager.tsx \
  /Users/marcus/Desktop/ptoainew3-main/utils/managerAgenda.ts
git commit -m "feat: allow manager task completion overrides"
```

---

### Task 4: Regression Coverage for Manager Override Data Logic

**Files:**
- Create: `/Users/marcus/Desktop/ptoainew3-main/tests/managerOverrides.test.ts`
- Optional create: `/Users/marcus/Desktop/ptoainew3-main/utils/managerOverrides.ts`

**Step 1: Write failing tests for pure merge/toggle logic**

Cover:
- Add task id to completed ids when unchecked
- Remove task id when checked
- Keep unique ids and stable sorted output

Example:

```ts
it('adds missing task id', () => {
  expect(applyCompletedTaskToggle(['a'], 'b', false)).toEqual(['a', 'b']);
});

it('removes existing task id', () => {
  expect(applyCompletedTaskToggle(['a', 'b'], 'b', true)).toEqual(['a']);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/managerOverrides.test.ts`  
Expected: FAIL with module not found.

**Step 3: Implement minimal helper**

Create pure function:

```ts
export const applyCompletedTaskToggle = (
  ids: string[],
  taskId: string,
  isCurrentlyCompleted: boolean
) => { /* minimal deterministic logic */ };
```

**Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/managerOverrides.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add /Users/marcus/Desktop/ptoainew3-main/tests/managerOverrides.test.ts \
  /Users/marcus/Desktop/ptoainew3-main/utils/managerOverrides.ts
git commit -m "test: cover manager override toggle logic"
```

---

### Task 5: End-to-End Verification + Changelog Check

**Files:**
- Verify only: `/Users/marcus/Desktop/ptoainew3-main/data/changelog.json`
- Verify route/page: `/Users/marcus/Desktop/ptoainew3-main/pages/IntranetManager.tsx`

**Step 1: Run full verification**

Run: `npm test`  
Expected: typecheck, lint, unit tests, and build all PASS.

**Step 2: Verify manager flow manually**

Checklist:
- Manager route `/intranet/manager` still staff+manager guarded.
- Toggle completion writes both tables.
- Notes still work.
- History still loads.

**Step 3: Verify changelog rendering contract**

Because this is a significant dashboard behavior change:
- Confirm `data/changelog.json` gets an entry on push (automation).
- Confirm `/changelog` page loads and renders latest entry.

**Step 4: Commit final integration if needed**

```bash
git add -A
git commit -m "feat: complete manager override flow and verification"
```
