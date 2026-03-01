const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

const getWeekdayCode = (dateKey: string): (typeof WEEKDAY_CODES)[number] | null => {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return WEEKDAY_CODES[parsed.getDay()];
};

type ReportLite = {
  user_id: string;
  report_date: string;
  did: string | null;
  handover: string | null;
  start_time: string | null;
  end_time: string | null;
};

type TemplateLite = {
  id: string;
  title: string;
  schedule_days: string[] | null;
  sort_order: number | null;
  estimated_minutes?: number | null;
};

type CompletionLite = {
  user_id: string;
  report_date: string;
  task_id: string;
};

type CustomTaskLite = {
  id: string;
  report_date: string;
  title: string;
  estimated_minutes: number | null;
  is_active: boolean;
};

type RemovalLite = {
  user_id: string;
  report_date: string;
  task_id: string;
  is_removed: boolean;
};

export type HistoricalReportTask = {
  id: string;
  title: string;
  estimatedMinutes: number | null;
  isCompleted: boolean;
  kind: 'template' | 'custom';
};

export type HistoricalReportSummary = ReportLite & {
  key: string;
  plannedCount: number;
  completedCount: number;
  completionLabel: string;
  status: 'complete' | 'incomplete' | 'no_plan';
  plannedTasks: HistoricalReportTask[];
};

export const buildHistoricalReportSummaries = (input: {
  reports: ReportLite[];
  templates: TemplateLite[];
  completions: CompletionLite[];
  customTasks: CustomTaskLite[];
  removals: RemovalLite[];
}): HistoricalReportSummary[] => {
  const completionByUserDay = new Map<string, Set<string>>();
  input.completions.forEach((row) => {
    const key = `${row.user_id}:${row.report_date}`;
    const existing = completionByUserDay.get(key) || new Set<string>();
    existing.add(row.task_id);
    completionByUserDay.set(key, existing);
  });

  const removedGlobalByDay = new Set<string>();
  input.removals.forEach((row) => {
    const key = `${row.report_date}:${row.task_id}`;
    if (row.is_removed) removedGlobalByDay.add(key);
    else removedGlobalByDay.delete(key);
  });

  const customByDay = new Map<string, CustomTaskLite[]>();
  input.customTasks.forEach((task) => {
    if (!task.is_active) return;
    const existing = customByDay.get(task.report_date) || [];
    existing.push(task);
    customByDay.set(task.report_date, existing);
  });

  return input.reports.map((report) => {
    const dayCode = getWeekdayCode(report.report_date);
    const templatesForDay = dayCode
      ? input.templates
        .filter((template) => (template.schedule_days || []).includes(dayCode))
        .filter((template) => !removedGlobalByDay.has(`${report.report_date}:${template.id}`))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      : [];

    const customForDay = customByDay.get(report.report_date) || [];
    const completedTaskIds = completionByUserDay.get(`${report.user_id}:${report.report_date}`) || new Set<string>();

    const plannedTasks: HistoricalReportTask[] = [
      ...templatesForDay.map((task) => ({
        id: task.id,
        title: task.title,
        estimatedMinutes: task.estimated_minutes ?? null,
        isCompleted: completedTaskIds.has(task.id),
        kind: 'template' as const
      })),
      ...customForDay.map((task) => {
        const taskId = `custom:${task.id}`;
        return {
          id: taskId,
          title: task.title,
          estimatedMinutes: task.estimated_minutes ?? null,
          isCompleted: completedTaskIds.has(taskId),
          kind: 'custom' as const
        };
      })
    ];

    const plannedCount = plannedTasks.length;
    const completedCount = plannedTasks.filter((task) => task.isCompleted).length;
    const status = plannedCount === 0
      ? 'no_plan'
      : completedCount >= plannedCount
        ? 'complete'
        : 'incomplete';

    return {
      ...report,
      key: `${report.user_id}:${report.report_date}`,
      plannedCount,
      completedCount,
      completionLabel: `${completedCount}/${plannedCount}`,
      status,
      plannedTasks
    };
  });
};
