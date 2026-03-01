type StaffLite = { id: string };

type TemplateLite = {
  id: string;
  title: string;
  schedule_days: string[] | null;
  sort_order: number | null;
  estimated_minutes?: number | null;
};

type CompletionItemLite = {
  user_id: string;
  report_date: string;
  task_id: string;
  completed_at: string;
};

type ReportLite = {
  user_id: string;
  report_date: string;
  start_time: string | null;
};

export type ManagerAlertOverrideLite = {
  user_id: string;
  report_date: string;
  task_id: string;
  is_alarming: boolean;
  reason?: string | null;
};

export type TaskAlertLevel = 'ok' | 'warning' | 'critical' | 'missing' | 'pending';

export type TaskDeltaRow = {
  user_id: string;
  report_date: string;
  task_id: string;
  title: string;
  sort_order: number;
  estimated_minutes: number | null;
  expected_completed_at: string;
  completed_at: string | null;
  delta_minutes: number | null;
  gap_since_previous_minutes: number | null;
  report_exists: boolean;
  auto_level: TaskAlertLevel;
  final_level: TaskAlertLevel;
  auto_is_alarming: boolean;
  final_is_alarming: boolean;
  manager_is_alarming: boolean | null;
  manager_reason: string | null;
};

type Input = {
  currentDateKey: string;
  dateKeys: string[];
  staff: StaffLite[];
  templates: TemplateLite[];
  completionItems: CompletionItemLite[];
  reports: ReportLite[];
  overrides: ManagerAlertOverrideLite[];
  warningMinutes?: number;
  criticalMinutes?: number;
};

type UserTotals = {
  scheduled_tasks: number;
  completed_tasks: number;
  completion_pct: number;
  avg_delta_minutes: number;
  alarming_tasks: number;
  warning_tasks: number;
  critical_tasks: number;
  missing_tasks: number;
  report_days: number;
  expected_report_days: number;
  report_coverage_pct: number;
};

type Output = {
  rows: TaskDeltaRow[];
  byUser: Record<string, UserTotals>;
  totals: UserTotals & {
    manager_overrides: number;
  };
};

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

const getWeekdayCode = (dateKey: string) => WEEKDAY_CODES[new Date(`${dateKey}T00:00:00`).getDay()];

const toPercent = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

const safeDateMs = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
};

const toMinutesDiff = (a: string, b: string) => {
  const aMs = safeDateMs(a);
  const bMs = safeDateMs(b);
  if (!Number.isFinite(aMs) || !Number.isFinite(bMs)) return 0;
  return Math.round((aMs - bMs) / 60000);
};

const toSafeIso = (ms: number) => {
  if (!Number.isFinite(ms)) return '1970-01-01T08:00:00.000Z';
  return new Date(ms).toISOString();
};

const buildExpectedIso = (dateKey: string, startTime: string | null | undefined, minuteOffset: number) => {
  void startTime;
  const preferred = safeDateMs(`${dateKey}T09:00:00`);
  if (Number.isFinite(preferred)) {
    return toSafeIso(preferred + minuteOffset * 60000);
  }
  const fallback = safeDateMs(`${dateKey}T09:00:00`);
  if (Number.isFinite(fallback)) {
    return toSafeIso(fallback + minuteOffset * 60000);
  }
  return '1970-01-01T09:00:00.000Z';
};

const classifyAutoLevel = (input: {
  isCompleted: boolean;
  isPastDate: boolean;
  deltaMinutes: number | null;
  warningMinutes: number;
  criticalMinutes: number;
}): { level: TaskAlertLevel; alarming: boolean } => {
  if (!input.isCompleted) {
    if (input.isPastDate) return { level: 'missing', alarming: true };
    return { level: 'pending', alarming: false };
  }

  const delta = input.deltaMinutes ?? 0;
  if (delta > input.criticalMinutes) return { level: 'critical', alarming: true };
  if (delta > input.warningMinutes) return { level: 'warning', alarming: true };
  return { level: 'ok', alarming: false };
};

const averageRounded = (values: number[]) => (
  values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0
);

export const buildTaskDeltaAnalysis = (input: Input): Output => {
  const warningMinutes = input.warningMinutes ?? 15;
  const criticalMinutes = input.criticalMinutes ?? 45;

  const reportByUserDate = new Map(input.reports.map((report) => [`${report.user_id}:${report.report_date}`, report]));
  const overrideByTask = new Map(input.overrides.map((override) => [
    `${override.user_id}:${override.report_date}:${override.task_id}`,
    override
  ]));

  const completionByUserDate = new Map<string, Map<string, CompletionItemLite>>();
  input.completionItems.forEach((item) => {
    const key = `${item.user_id}:${item.report_date}`;
    if (!completionByUserDate.has(key)) completionByUserDate.set(key, new Map());
    completionByUserDate.get(key)!.set(item.task_id, item);
  });

  const templatesByDate: Record<string, TemplateLite[]> = {};
  input.dateKeys.forEach((dateKey) => {
    const dayCode = getWeekdayCode(dateKey);
    templatesByDate[dateKey] = input.templates
      .filter((template) => (template.schedule_days || []).includes(dayCode))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  });

  const rows: TaskDeltaRow[] = [];

  input.staff.forEach((member) => {
    input.dateKeys.forEach((dateKey) => {
      const key = `${member.id}:${dateKey}`;
      const report = reportByUserDate.get(key);
      const completionsForDay = completionByUserDate.get(key) || new Map<string, CompletionItemLite>();
      const templatesForDay = templatesByDate[dateKey] || [];
      const isPastDate = dateKey < input.currentDateKey;

      let cumulativeMinutes = 0;
      let previousCompletedAt: string | null = null;

      templatesForDay.forEach((template) => {
        const estimated = template.estimated_minutes ?? null;
        cumulativeMinutes += estimated ?? 0;

        const completion = completionsForDay.get(template.id);
        const expectedCompletedAt = buildExpectedIso(dateKey, report?.start_time ?? null, cumulativeMinutes);
        const deltaMinutes = completion ? toMinutesDiff(completion.completed_at, expectedCompletedAt) : null;
        const auto = classifyAutoLevel({
          isCompleted: Boolean(completion),
          isPastDate,
          deltaMinutes,
          warningMinutes,
          criticalMinutes
        });

        const override = overrideByTask.get(`${member.id}:${dateKey}:${template.id}`);
        const finalIsAlarming = override ? override.is_alarming : auto.alarming;

        let finalLevel: TaskAlertLevel;
        if (override) {
          if (!override.is_alarming) finalLevel = 'ok';
          else if (auto.level === 'ok' || auto.level === 'pending') finalLevel = 'warning';
          else finalLevel = auto.level;
        } else {
          finalLevel = auto.level;
        }

        const gapSincePrevious = completion && previousCompletedAt
          ? toMinutesDiff(completion.completed_at, previousCompletedAt)
          : null;

        if (completion) {
          previousCompletedAt = completion.completed_at;
        }

        rows.push({
          user_id: member.id,
          report_date: dateKey,
          task_id: template.id,
          title: template.title,
          sort_order: template.sort_order ?? 0,
          estimated_minutes: estimated,
          expected_completed_at: expectedCompletedAt,
          completed_at: completion?.completed_at ?? null,
          delta_minutes: deltaMinutes,
          gap_since_previous_minutes: gapSincePrevious,
          report_exists: Boolean(report),
          auto_level: auto.level,
          final_level: finalLevel,
          auto_is_alarming: auto.alarming,
          final_is_alarming: finalIsAlarming,
          manager_is_alarming: override?.is_alarming ?? null,
          manager_reason: override?.reason ?? null
        });
      });
    });
  });

  rows.sort((a, b) => {
    if (a.report_date !== b.report_date) return b.report_date.localeCompare(a.report_date);
    if (a.user_id !== b.user_id) return a.user_id.localeCompare(b.user_id);
    return a.sort_order - b.sort_order;
  });

  const byUser: Record<string, UserTotals> = {};
  const reportDaysByUser = new Map<string, Set<string>>();
  const expectedReportDaysByUser = new Map<string, Set<string>>();

  rows.forEach((row) => {
    if (!byUser[row.user_id]) {
      byUser[row.user_id] = {
        scheduled_tasks: 0,
        completed_tasks: 0,
        completion_pct: 0,
        avg_delta_minutes: 0,
        alarming_tasks: 0,
        warning_tasks: 0,
        critical_tasks: 0,
        missing_tasks: 0,
        report_days: 0,
        expected_report_days: 0,
        report_coverage_pct: 0
      };
      reportDaysByUser.set(row.user_id, new Set());
      expectedReportDaysByUser.set(row.user_id, new Set());
    }

    const user = byUser[row.user_id];
    user.scheduled_tasks += 1;
    if (row.completed_at) user.completed_tasks += 1;
    if (row.final_is_alarming) user.alarming_tasks += 1;
    if (row.final_level === 'warning') user.warning_tasks += 1;
    if (row.final_level === 'critical') user.critical_tasks += 1;
    if (row.final_level === 'missing') user.missing_tasks += 1;

    expectedReportDaysByUser.get(row.user_id)!.add(row.report_date);
    if (row.report_exists) reportDaysByUser.get(row.user_id)!.add(row.report_date);
  });

  const deltaByUser: Record<string, number[]> = {};
  rows.forEach((row) => {
    if (row.delta_minutes === null) return;
    if (!deltaByUser[row.user_id]) deltaByUser[row.user_id] = [];
    deltaByUser[row.user_id].push(row.delta_minutes);
  });

  Object.keys(byUser).forEach((userId) => {
    byUser[userId].completion_pct = toPercent(byUser[userId].completed_tasks, byUser[userId].scheduled_tasks);
    byUser[userId].avg_delta_minutes = averageRounded(deltaByUser[userId] || []);
    byUser[userId].expected_report_days = expectedReportDaysByUser.get(userId)?.size || 0;
    byUser[userId].report_days = reportDaysByUser.get(userId)?.size || 0;
    byUser[userId].report_coverage_pct = toPercent(byUser[userId].report_days, byUser[userId].expected_report_days);
  });

  const initialTotals: Output['totals'] = {
    scheduled_tasks: 0,
    completed_tasks: 0,
    completion_pct: 0,
    avg_delta_minutes: 0,
    alarming_tasks: 0,
    warning_tasks: 0,
    critical_tasks: 0,
    missing_tasks: 0,
    report_days: 0,
    expected_report_days: 0,
    report_coverage_pct: 0,
    manager_overrides: input.overrides.length
  };

  const totals = Object.values(byUser).reduce<Output['totals']>((acc, user) => {
    acc.scheduled_tasks += user.scheduled_tasks;
    acc.completed_tasks += user.completed_tasks;
    acc.alarming_tasks += user.alarming_tasks;
    acc.warning_tasks += user.warning_tasks;
    acc.critical_tasks += user.critical_tasks;
    acc.missing_tasks += user.missing_tasks;
    acc.report_days += user.report_days;
    acc.expected_report_days += user.expected_report_days;
    return acc;
  }, initialTotals);

  const deltas = rows
    .map((row) => row.delta_minutes)
    .filter((value): value is number => value !== null);

  totals.completion_pct = toPercent(totals.completed_tasks, totals.scheduled_tasks);
  totals.avg_delta_minutes = averageRounded(deltas);
  totals.report_coverage_pct = toPercent(totals.report_days, totals.expected_report_days);

  return {
    rows,
    byUser,
    totals
  };
};
