type AgendaTemplate = {
  id: string;
  title: string;
  schedule_days: string[] | null;
  sort_order: number | null;
  estimated_minutes?: number | null;
};

type CompletionItem = {
  user_id: string;
  report_date: string;
  task_id: string;
  completed_at: string;
  completed_by: string;
};

type ReportLite = { start_time: string | null };

const QUALITY_CHECK_TITLES = new Set(['startupplägg', 'uppföljningsupplägg', 'ärenden', 'app']);
const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

const normalizeTitle = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
const getWeekdayCode = (dateKey: string) => WEEKDAY_CODES[new Date(`${dateKey}T00:00:00`).getDay()];

export const isSlowTask = (input: {
  completedAt: string;
  anchorTime: string;
  estimatedMinutes: number | null | undefined;
}) => {
  if (!input.estimatedMinutes) return false;
  const completed = new Date(input.completedAt).getTime();
  const anchor = new Date(input.anchorTime).getTime();
  return completed - anchor > input.estimatedMinutes * 60 * 1000;
};

const buildAnchorTime = (dateKey: string, report: ReportLite | undefined) => {
  if (report?.start_time) {
    return new Date(`${dateKey}T${report.start_time}:00`).toISOString();
  }
  return new Date(`${dateKey}T08:00:00`).toISOString();
};

type DailyTaskStatus = {
  task_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  is_slow: boolean;
  requires_quality_check: boolean;
};

type DailyUserSummary = {
  total: number;
  completed: number;
  last_completed_at: string | null;
  tasks: DailyTaskStatus[];
};

export const buildDailyAgendaSummary = (input: {
  dateKey: string;
  staff: Array<{ id: string }>;
  templates: AgendaTemplate[];
  completionItems: CompletionItem[];
  reportsByUser: Record<string, ReportLite | undefined>;
}) => {
  const byUser: Record<string, DailyUserSummary> = {};
  const itemsByUser = new Map<string, CompletionItem[]>();

  input.completionItems.forEach((item) => {
    if (!itemsByUser.has(item.user_id)) itemsByUser.set(item.user_id, []);
    itemsByUser.get(item.user_id)!.push(item);
  });

  const dayCode = getWeekdayCode(input.dateKey);
  const dayTemplates = input.templates
    .filter((template) => (template.schedule_days || []).includes(dayCode))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  input.staff.forEach((staff) => {
    const userItems = itemsByUser.get(staff.id) || [];
    const byTask = new Map(userItems.map((item) => [item.task_id, item]));
    const report = input.reportsByUser[staff.id];
    const anchorTime = buildAnchorTime(input.dateKey, report);

    const tasks: DailyTaskStatus[] = dayTemplates.map((template) => {
      const completed = byTask.get(template.id);
      const requiresQualityCheck = QUALITY_CHECK_TITLES.has(normalizeTitle(template.title));
      return {
        task_id: template.id,
        title: template.title,
        is_completed: !!completed,
        completed_at: completed?.completed_at ?? null,
        completed_by: completed?.completed_by ?? null,
        is_slow: completed
          ? isSlowTask({
              completedAt: completed.completed_at,
              anchorTime,
              estimatedMinutes: template.estimated_minutes
            })
          : false,
        requires_quality_check: requiresQualityCheck
      };
    });

    const completedTimes = tasks
      .map((task) => task.completed_at)
      .filter(Boolean)
      .sort();

    byUser[staff.id] = {
      total: tasks.length,
      completed: tasks.filter((task) => task.is_completed).length,
      last_completed_at: completedTimes.length ? completedTimes[completedTimes.length - 1] : null,
      tasks
    };
  });

  return { byUser };
};
