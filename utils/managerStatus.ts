type TemplateLite = {
  id: string;
  schedule_days: string[] | null;
  estimated_minutes: number | null | undefined;
};

type CustomTaskLite = {
  id: string;
  report_date: string;
  estimated_minutes: number | null;
  is_active: boolean;
};

type RemovalLite = {
  report_date: string;
  task_id: string;
  is_removed: boolean;
};

type ReportLite = {
  user_id: string;
  report_date: string;
  start_time: string | null;
  end_time: string | null;
};

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

const getWeekdayCode = (dateKey: string) => {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return WEEKDAY_CODES[parsed.getDay()];
};

const parseTimeMinutes = (value: string | null) => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const toPercent = (num: number, den: number) => (
  den > 0 ? Math.round((num / den) * 100) : 0
);

export const computeOverEstimateDays = (input: {
  dateKeys: string[];
  templates: TemplateLite[];
  customTasks: CustomTaskLite[];
  removals: RemovalLite[];
  reports: ReportLite[];
}) => {
  let comparableDays = 0;
  let overEstimateDays = 0;

  const templateMinutesByDate = new Map<string, number>();
  input.dateKeys.forEach((dateKey) => {
    const dayCode = getWeekdayCode(dateKey);
    if (!dayCode) {
      templateMinutesByDate.set(dateKey, 0);
      return;
    }

    const removedTasks = new Set(
      input.removals
        .filter((row) => row.report_date === dateKey && row.is_removed)
        .map((row) => row.task_id)
    );

    const templateMinutes = input.templates
      .filter((template) => (template.schedule_days || []).includes(dayCode))
      .filter((template) => !removedTasks.has(template.id))
      .reduce((sum, template) => sum + (template.estimated_minutes || 0), 0);

    const customMinutes = input.customTasks
      .filter((task) => task.is_active && task.report_date === dateKey)
      .reduce((sum, task) => sum + (task.estimated_minutes || 0), 0);

    templateMinutesByDate.set(dateKey, templateMinutes + customMinutes);
  });

  const longestDurationByDate = new Map<string, number>();
  input.reports.forEach((report) => {
    if (!input.dateKeys.includes(report.report_date)) return;

    const startMinutes = parseTimeMinutes(report.start_time);
    const endMinutes = parseTimeMinutes(report.end_time);
    if (startMinutes === null || endMinutes === null) return;

    let durationMinutes = endMinutes - startMinutes;
    if (durationMinutes < 0) durationMinutes += 24 * 60;
    if (durationMinutes <= 0) return;

    const previous = longestDurationByDate.get(report.report_date) || 0;
    if (durationMinutes > previous) {
      longestDurationByDate.set(report.report_date, durationMinutes);
    }
  });

  input.dateKeys.forEach((dateKey) => {
    const estimatedMinutes = templateMinutesByDate.get(dateKey) || 0;
    const durationMinutes = longestDurationByDate.get(dateKey);
    if (!durationMinutes || estimatedMinutes <= 0) return;

    comparableDays += 1;
    if (durationMinutes > estimatedMinutes) overEstimateDays += 1;
  });

  return {
    comparableDays,
    overEstimateDays,
    overEstimatePct: toPercent(overEstimateDays, comparableDays)
  };
};
