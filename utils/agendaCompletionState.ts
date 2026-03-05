type CompletionItemRow = { task_id: string };
type CompletionItemByDateRow = { report_date: string; task_id: string };
type LegacyCompletionRow = { report_date: string; completed_task_ids: unknown };

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

export const buildCompletionMapByDate = (input: {
  dateKeys: string[];
  completionItemRows: CompletionItemByDateRow[];
  legacyRows: LegacyCompletionRow[];
  completionItemsAvailable?: boolean;
}) => {
  const completionItemsAvailable = input.completionItemsAvailable ?? input.completionItemRows.length > 0;
  const rowsByDate = input.completionItemRows.reduce<Record<string, CompletionItemRow[]>>((acc, row) => {
    if (!row?.report_date) return acc;
    if (!acc[row.report_date]) acc[row.report_date] = [];
    acc[row.report_date].push({ task_id: row.task_id });
    return acc;
  }, {});
  const legacyByDate = input.legacyRows.reduce<Record<string, LegacyCompletionRow>>((acc, row) => {
    if (!row?.report_date) return acc;
    acc[row.report_date] = row;
    return acc;
  }, {});

  return input.dateKeys.reduce<Record<string, string[]>>((acc, dateKey) => {
    const ids = resolveCompletedTaskIds({
      completionItemsAvailable,
      completionItemRows: rowsByDate[dateKey] || [],
      legacyCompletedTaskIds: parseCompletedTaskIds(legacyByDate[dateKey]?.completed_task_ids)
    });
    acc[dateKey] = ids;
    return acc;
  }, {});
};
