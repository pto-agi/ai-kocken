import { buildAnchorTime, isSlowTask } from './managerAgenda';

type Staff = { id: string };

type Template = {
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
};

type Report = {
  user_id: string;
  report_date: string;
  start_time: string | null;
};

type Input = {
  dateKeys: string[];
  staff: Staff[];
  templates: Template[];
  completionItems: CompletionItem[];
  reports: Report[];
};

type UserMetrics = {
  expectedTasks: number;
  completedTasks: number;
  adherencePct: number;
  reportDays: number;
  expectedReportDays: number;
  reportCoveragePct: number;
  qualityExpected: number;
  qualityCompleted: number;
  qualityCoveragePct: number;
  slowTasks: number;
};

type Output = {
  byUser: Record<string, UserMetrics>;
  totals: {
    expectedTasks: number;
    completedTasks: number;
    adherencePct: number;
    reportDays: number;
    expectedReportDays: number;
    reportCoveragePct: number;
    qualityExpected: number;
    qualityCompleted: number;
    qualityCoveragePct: number;
    slowTasks: number;
  };
};

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const QUALITY_CHECK_TITLES = new Set(['startupplägg', 'uppföljningsupplägg', 'ärenden', 'app']);

const normalizeTitle = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();
const getWeekdayCode = (dateKey: string) => WEEKDAY_CODES[new Date(`${dateKey}T00:00:00`).getDay()];
const toPercent = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

export const computeWeeklyPerformance = (input: Input): Output => {
  const templatesByDate: Record<string, Template[]> = {};
  input.dateKeys.forEach((dateKey) => {
    const dayCode = getWeekdayCode(dateKey);
    templatesByDate[dateKey] = input.templates
      .filter((template) => (template.schedule_days || []).includes(dayCode))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  });

  const templateById = new Map(input.templates.map((template) => [template.id, template]));
  const reportByUserDate = new Map(input.reports.map((report) => [`${report.user_id}:${report.report_date}`, report]));

  const completionSetByUserDate = new Map<string, Set<string>>();
  input.completionItems.forEach((item) => {
    const key = `${item.user_id}:${item.report_date}`;
    if (!completionSetByUserDate.has(key)) completionSetByUserDate.set(key, new Set());
    completionSetByUserDate.get(key)!.add(item.task_id);
  });

  const byUser: Record<string, UserMetrics> = {};

  input.staff.forEach((member) => {
    let expectedTasks = 0;
    let completedTasks = 0;
    let reportDays = 0;
    let expectedReportDays = 0;
    let qualityExpected = 0;
    let qualityCompleted = 0;
    let slowTasks = 0;

    input.dateKeys.forEach((dateKey) => {
      const scheduledTemplates = templatesByDate[dateKey] || [];
      if (scheduledTemplates.length > 0) expectedReportDays += 1;
      expectedTasks += scheduledTemplates.length;

      const completionKey = `${member.id}:${dateKey}`;
      const completedIds = completionSetByUserDate.get(completionKey) || new Set<string>();
      completedTasks += completedIds.size;

      const report = reportByUserDate.get(completionKey);
      if (report) reportDays += 1;

      scheduledTemplates.forEach((template) => {
        const quality = QUALITY_CHECK_TITLES.has(normalizeTitle(template.title));
        if (quality) {
          qualityExpected += 1;
          if (completedIds.has(template.id)) qualityCompleted += 1;
        }
      });

      completedIds.forEach((taskId) => {
        const completionItem = input.completionItems.find((item) => (
          item.user_id === member.id && item.report_date === dateKey && item.task_id === taskId
        ));
        const template = templateById.get(taskId);
        if (!completionItem || !template?.estimated_minutes) return;

        const anchor = buildAnchorTime(dateKey, report ? { start_time: report.start_time } : undefined);

        const isSlow = isSlowTask({
          completedAt: completionItem.completed_at,
          anchorTime: anchor,
          estimatedMinutes: template.estimated_minutes
        });

        if (isSlow) slowTasks += 1;
      });
    });

    byUser[member.id] = {
      expectedTasks,
      completedTasks,
      adherencePct: toPercent(completedTasks, expectedTasks),
      reportDays,
      expectedReportDays,
      reportCoveragePct: toPercent(reportDays, expectedReportDays),
      qualityExpected,
      qualityCompleted,
      qualityCoveragePct: toPercent(qualityCompleted, qualityExpected),
      slowTasks
    };
  });

  const totals = Object.values(byUser).reduce((acc, user) => {
    acc.expectedTasks += user.expectedTasks;
    acc.completedTasks += user.completedTasks;
    acc.reportDays += user.reportDays;
    acc.expectedReportDays += user.expectedReportDays;
    acc.qualityExpected += user.qualityExpected;
    acc.qualityCompleted += user.qualityCompleted;
    acc.slowTasks += user.slowTasks;
    return acc;
  }, {
    expectedTasks: 0,
    completedTasks: 0,
    reportDays: 0,
    expectedReportDays: 0,
    qualityExpected: 0,
    qualityCompleted: 0,
    slowTasks: 0
  });

  return {
    byUser,
    totals: {
      ...totals,
      adherencePct: toPercent(totals.completedTasks, totals.expectedTasks),
      reportCoveragePct: toPercent(totals.reportDays, totals.expectedReportDays),
      qualityCoveragePct: toPercent(totals.qualityCompleted, totals.qualityExpected)
    }
  };
};
