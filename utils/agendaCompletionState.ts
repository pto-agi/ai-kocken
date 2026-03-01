type CompletionItemRow = { task_id: string };

const sanitizeTaskIds = (values: unknown[]) => (
  Array.from(
    new Set(
      values.filter((value) => typeof value === 'string' && value.length > 0)
    )
  ) as string[]
);

export const parseCompletedTaskIds = (raw: unknown) => {
  if (Array.isArray(raw)) return sanitizeTaskIds(raw);
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return sanitizeTaskIds(parsed);
  } catch {
    // ignore parse failure
  }
  return [];
};

export const resolveCompletedTaskIds = (input: {
  completionItemsAvailable: boolean;
  completionItemRows: CompletionItemRow[];
  legacyCompletedTaskIds: string[];
}) => {
  if (input.completionItemsAvailable) {
    return Array.from(
      new Set(
        input.completionItemRows
          .map((row) => row.task_id)
          .filter((value) => typeof value === 'string' && value.length > 0)
      )
    );
  }

  return Array.from(
    new Set(
      (input.legacyCompletedTaskIds || []).filter((value) => (
        typeof value === 'string' && value.length > 0
      ))
    )
  );
};
