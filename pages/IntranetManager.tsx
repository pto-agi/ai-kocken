import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Loader2, Search, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { formatDateKey } from '../utils/managerDashboard';
import { buildDailyAgendaSummary } from '../utils/managerAgenda';
import { groupNotesByUserDate } from '../utils/managerNotes';
import { buildCompletionItemAction } from '../utils/agendaCompletionItems';
import { applyCompletedTaskToggle } from '../utils/managerOverrides';
import { computeWeeklyPerformance } from '../utils/managerPerformance';
import { buildTaskDeltaAnalysis, type ManagerAlertOverrideLite, type TaskDeltaRow } from '../utils/managerAnalytics';
import { buildTaskRemovalSet, isTaskRemoved } from '../utils/managerTaskRemovals';
import { buildHistoricalReportSummaries } from '../utils/managerHistoricalReports';
import { computeOverEstimateDays } from '../utils/managerStatus';
import { resolveUniversalAgendaUserId } from '../utils/managerUniversalAgenda';

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
const getWeekdayCode = (dateKey: string) => WEEKDAY_CODES[new Date(`${dateKey}T00:00:00`).getDay()];
const getRecentDateKeys = (date: Date, count = 7) => {
  const keys: string[] = [];
  const base = new Date(date);
  for (let i = 0; i < count; i += 1) {
    const current = new Date(base);
    current.setDate(base.getDate() - i);
    keys.push(formatDateKey(current));
  }
  return keys;
};
const formatTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Stockholm'
  });
};

const truncateText = (value: string | null | undefined, max = 120) => {
  if (!value) return '—';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…`;
};

const getHistoricalStatusMeta = (status: 'complete' | 'incomplete' | 'no_plan') => {
  if (status === 'complete') {
    return {
      label: 'Klar',
      dot: 'bg-emerald-500',
      badge: 'border-emerald-300/60 bg-emerald-50 text-emerald-700'
    };
  }
  if (status === 'incomplete') {
    return {
      label: 'Avvikelse',
      dot: 'bg-rose-500',
      badge: 'border-rose-300/60 bg-rose-50 text-rose-700'
    };
  }
  return {
    label: 'Ingen plan',
    dot: 'bg-slate-400',
    badge: 'border-slate-300/60 bg-slate-50 text-slate-700'
  };
};

const ui = {
  page: 'min-h-screen bg-[#F3F4F6] text-[#111111] font-sans pb-20 pt-24 px-4',
  card: 'rounded-2xl border border-[#9CA3AF] bg-white p-5',
  label: 'text-[10px] font-black uppercase tracking-[0.3em] text-[#111111]',
  body: 'text-sm text-[#333333]'
};

type StaffProfile = { id: string; full_name?: string | null; email?: string | null; is_staff?: boolean | null; is_manager?: boolean | null };

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
  source?: string | null;
};

type AgendaReport = {
  user_id: string;
  report_date: string;
  did: string | null;
  handover: string | null;
  start_time: string | null;
  end_time: string | null;
};

type WeeklyReport = {
  user_id: string;
  report_date: string;
  start_time: string | null;
};

type ManagerNote = {
  id: string;
  user_id: string;
  report_date: string;
  task_id: string | null;
  note: string;
  created_by: string;
  created_at: string;
};

type ManagerAlertOverride = ManagerAlertOverrideLite & {
  set_by?: string | null;
  set_at?: string | null;
};

type ManagerCustomTask = {
  id: string;
  user_id: string;
  report_date: string;
  title: string;
  estimated_minutes: number | null;
  details: string | null;
  created_by: string;
  created_at: string;
  is_active: boolean;
};

type ManagerTaskRemoval = {
  user_id: string;
  report_date: string;
  task_id: string;
  is_removed: boolean;
  reason: string | null;
  set_by: string;
  set_at: string;
};

type AgendaProject = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  is_done: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export const IntranetManager: React.FC = () => {
  const { profile } = useAuthStore();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [templates, setTemplates] = useState<AgendaTemplate[]>([]);
  const [completionItems, setCompletionItems] = useState<CompletionItem[]>([]);
  const [reports, setReports] = useState<AgendaReport[]>([]);
  const [weeklyCompletionItems, setWeeklyCompletionItems] = useState<CompletionItem[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [projects, setProjects] = useState<AgendaProject[]>([]);
  const [projectsSupported, setProjectsSupported] = useState(true);
  const [projectEditorOpen, setProjectEditorOpen] = useState<Record<string, boolean>>({});
  const [projectDetailsOpen, setProjectDetailsOpen] = useState<Record<string, boolean>>({});
  const [activeProjectsExpanded, setActiveProjectsExpanded] = useState(false);
  const [projectDrafts, setProjectDrafts] = useState<Record<string, { title: string; description: string }>>({});
  const [newProjectDraft, setNewProjectDraft] = useState<{ title: string; description: string }>({ title: '', description: '' });
  const [showAddProjectForm, setShowAddProjectForm] = useState(false);
  const [projectMutationState, setProjectMutationState] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});
  const [notes, setNotes] = useState<ManagerNote[]>([]);
  const [customTasks, setCustomTasks] = useState<ManagerCustomTask[]>([]);
  const [customTasksSupported, setCustomTasksSupported] = useState(true);
  const [customTaskDrafts, setCustomTaskDrafts] = useState<Record<string, { title: string; estimated_minutes: string; details: string }>>({});
  const [customTaskMutationState, setCustomTaskMutationState] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});
  const [expandedTaskDetails, setExpandedTaskDetails] = useState<Record<string, boolean>>({});
  const [taskNoteDrafts, setTaskNoteDrafts] = useState<Record<string, string>>({});
  const [taskNoteStatus, setTaskNoteStatus] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});
  const [taskRemovals, setTaskRemovals] = useState<ManagerTaskRemoval[]>([]);
  const [taskRemovalsSupported, setTaskRemovalsSupported] = useState(true);
  const [taskRemovalMutationState, setTaskRemovalMutationState] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});
  const [historicalReports, setHistoricalReports] = useState<AgendaReport[]>([]);
  const [historicalCompletionItems, setHistoricalCompletionItems] = useState<CompletionItem[]>([]);
  const [historicalCustomTasks, setHistoricalCustomTasks] = useState<ManagerCustomTask[]>([]);
  const [historicalTaskRemovals, setHistoricalTaskRemovals] = useState<ManagerTaskRemoval[]>([]);
  const [selectedHistoricalReportKey, setSelectedHistoricalReportKey] = useState<string | null>(null);
  const [alertOverrides, setAlertOverrides] = useState<ManagerAlertOverride[]>([]);
  const [alertOverrideSupported, setAlertOverrideSupported] = useState(true);
  const [alertMutationState, setAlertMutationState] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});
  const [alertReasonDrafts, setAlertReasonDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteStatus, setNoteStatus] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});
  const [showManagerAddTaskForm, setShowManagerAddTaskForm] = useState(false);
  const [staffFilter, setStaffFilter] = useState('');
  const [analysisWindowDays, setAnalysisWindowDays] = useState<1 | 7 | 30>(7);
  const [sectionOpen, setSectionOpen] = useState<Record<'overview' | 'reports' | 'projects' | 'staff', boolean>>({
    overview: true,
    reports: true,
    projects: true,
    staff: true
  });
  const [expandedStaff, setExpandedStaff] = useState<Record<string, boolean>>({});
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [historyItemsByUser, setHistoryItemsByUser] = useState<Record<string, CompletionItem[]>>({});
  const [historyReportsByUser, setHistoryReportsByUser] = useState<Record<string, AgendaReport[]>>({});
  const [taskMutationState, setTaskMutationState] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});

  const selectedDate = useMemo(() => new Date(), []);
  const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const historyKeys = useMemo(() => getRecentDateKeys(selectedDate, 7), [selectedDate]);
  const analysisKeys = useMemo(() => getRecentDateKeys(selectedDate, analysisWindowDays), [selectedDate, analysisWindowDays]);
  const dataWindowDays = useMemo(() => (analysisWindowDays === 30 ? 30 : 7), [analysisWindowDays]);
  const dataKeys = useMemo(() => getRecentDateKeys(selectedDate, dataWindowDays), [selectedDate, dataWindowDays]);

  useEffect(() => {
    const fontLinkId = 'google-sans-code-font';
    if (document.getElementById(fontLinkId)) return;
    const link = document.createElement('link');
    link.id = fontLinkId;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Google+Sans+Code:wght@400;500;700;800&display=swap';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    const load = async () => {
      setStatus('loading');
      setError(null);
      try {
        const rangeStart = dataKeys[dataKeys.length - 1] || dateKey;
        const [staffRes, templateRes, completionRes, reportRes, projectsRes, notesRes, weeklyCompletionRes, weeklyReportRes, historicalReportsRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email, is_staff, is_manager').eq('is_staff', true),
          supabase.from('agenda_templates').select('id,title,schedule_days,sort_order,estimated_minutes').eq('is_active', true),
          supabase
            .from('agenda_completion_items')
            .select('user_id, report_date, task_id, completed_at, completed_by, source')
            .eq('report_date', dateKey),
          supabase
            .from('agenda_reports')
            .select('user_id, report_date, did, handover, start_time, end_time')
            .eq('report_date', dateKey),
          supabase
            .from('agenda_projects')
            .select('id, title, description, sort_order, is_done, is_active, created_at, updated_at')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: true }),
          supabase
            .from('agenda_manager_notes')
            .select('id, user_id, report_date, task_id, note, created_by, created_at')
            .eq('report_date', dateKey),
          supabase
            .from('agenda_completion_items')
            .select('user_id, report_date, task_id, completed_at')
            .gte('report_date', rangeStart)
            .lte('report_date', dateKey),
          supabase
            .from('agenda_reports')
            .select('user_id, report_date, start_time')
            .gte('report_date', rangeStart)
            .lte('report_date', dateKey),
          supabase
            .from('agenda_reports')
            .select('user_id, report_date, did, handover, start_time, end_time')
            .lte('report_date', dateKey)
            .order('report_date', { ascending: false })
        ]);

        if (staffRes.error) throw staffRes.error;
        if (templateRes.error) throw templateRes.error;
        if (completionRes.error) throw completionRes.error;
        if (reportRes.error) throw reportRes.error;
        if (notesRes.error) throw notesRes.error;
        if (weeklyCompletionRes.error) throw weeklyCompletionRes.error;
        if (weeklyReportRes.error) throw weeklyReportRes.error;
        if (historicalReportsRes.error) throw historicalReportsRes.error;
        if (!active) return;

        setStaff(staffRes.data || []);
        setTemplates(templateRes.data || []);
        setCompletionItems(completionRes.data || []);
        setReports(reportRes.data || []);
        if (projectsRes.error) {
          console.warn('Agenda projects unavailable', projectsRes.error);
          setProjectsSupported(false);
          setProjects([]);
        } else {
          setProjectsSupported(true);
          setProjects((projectsRes.data || []) as AgendaProject[]);
        }
        setNotes(notesRes.data || []);
        setWeeklyCompletionItems((weeklyCompletionRes.data || []) as CompletionItem[]);
        setWeeklyReports((weeklyReportRes.data || []) as WeeklyReport[]);
        setHistoricalReports((historicalReportsRes.data || []) as AgendaReport[]);

        const historicalCompletionRes = await supabase
          .from('agenda_completion_items')
          .select('user_id, report_date, task_id, completed_at, completed_by, source')
          .lte('report_date', dateKey);

        if (!active) return;
        if (historicalCompletionRes.error) {
          console.warn('Historical completion items unavailable', historicalCompletionRes.error);
          setHistoricalCompletionItems([]);
        } else {
          setHistoricalCompletionItems((historicalCompletionRes.data || []) as CompletionItem[]);
        }

        const customTasksRes = await supabase
          .from('agenda_manager_custom_tasks')
          .select('id, user_id, report_date, title, estimated_minutes, details, created_by, created_at, is_active')
          .eq('report_date', dateKey)
          .eq('is_active', true)
          .order('created_at', { ascending: true });

        if (!active) return;
        if (customTasksRes.error) {
          console.warn('Custom tasks unavailable', customTasksRes.error);
          setCustomTasksSupported(false);
          setCustomTasks([]);
          setHistoricalCustomTasks([]);
        } else {
          setCustomTasksSupported(true);
          setCustomTasks((customTasksRes.data || []) as ManagerCustomTask[]);

          const historicalCustomTasksRes = await supabase
            .from('agenda_manager_custom_tasks')
            .select('id, user_id, report_date, title, estimated_minutes, details, created_by, created_at, is_active')
            .eq('is_active', true)
            .lte('report_date', dateKey)
            .order('created_at', { ascending: true });

          if (!active) return;
          if (historicalCustomTasksRes.error) {
            console.warn('Historical custom tasks unavailable', historicalCustomTasksRes.error);
            setHistoricalCustomTasks([]);
          } else {
            setHistoricalCustomTasks((historicalCustomTasksRes.data || []) as ManagerCustomTask[]);
          }
        }

        const taskRemovalRes = await supabase
          .from('agenda_manager_task_removals')
          .select('user_id, report_date, task_id, is_removed, reason, set_by, set_at')
          .eq('report_date', dateKey);

        if (!active) return;
        if (taskRemovalRes.error) {
          console.warn('Task removals unavailable', taskRemovalRes.error);
          setTaskRemovalsSupported(false);
          setTaskRemovals([]);
          setHistoricalTaskRemovals([]);
        } else {
          setTaskRemovalsSupported(true);
          setTaskRemovals((taskRemovalRes.data || []) as ManagerTaskRemoval[]);

          const historicalTaskRemovalRes = await supabase
            .from('agenda_manager_task_removals')
            .select('user_id, report_date, task_id, is_removed, reason, set_by, set_at')
            .lte('report_date', dateKey);

          if (!active) return;
          if (historicalTaskRemovalRes.error) {
            console.warn('Historical task removals unavailable', historicalTaskRemovalRes.error);
            setHistoricalTaskRemovals([]);
          } else {
            setHistoricalTaskRemovals((historicalTaskRemovalRes.data || []) as ManagerTaskRemoval[]);
          }
        }

        const overrideRes = await supabase
          .from('agenda_manager_alert_overrides')
          .select('user_id, report_date, task_id, is_alarming, reason, set_by, set_at')
          .gte('report_date', rangeStart)
          .lte('report_date', dateKey);

        if (!active) return;
        if (overrideRes.error) {
          console.warn('Alert overrides unavailable', overrideRes.error);
          setAlertOverrideSupported(false);
          setAlertOverrides([]);
        } else {
          setAlertOverrideSupported(true);
          setAlertOverrides((overrideRes.data || []) as ManagerAlertOverride[]);
        }
        setStatus('idle');
      } catch (err: any) {
        if (!active) return;
        console.warn('Manager dashboard load failed', err);
        setStatus('error');
        setError('Kunde inte hämta manager-data.');
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [dataKeys, dateKey]);

  const reportsByUser = useMemo(() => {
    const map: Record<string, AgendaReport | undefined> = {};
    reports.forEach((report) => {
      map[report.user_id] = report;
    });
    return map;
  }, [reports]);

  const dailySummary = useMemo(() => (
    buildDailyAgendaSummary({
      dateKey,
      staff,
      templates,
      completionItems,
      reportsByUser
    })
  ), [dateKey, staff, templates, completionItems, reportsByUser]);

  const notesByUserDate = useMemo(() => groupNotesByUserDate(notes), [notes]);
  const removedTaskSet = useMemo(() => buildTaskRemovalSet(taskRemovals), [taskRemovals]);

  const weeklyPerformance = useMemo(() => (
    computeWeeklyPerformance({
      dateKeys: historyKeys,
      staff,
      templates,
      completionItems: weeklyCompletionItems,
      reports: weeklyReports
    })
  ), [historyKeys, staff, templates, weeklyCompletionItems, weeklyReports]);

  const windowPerformance = useMemo(() => (
    computeWeeklyPerformance({
      dateKeys: analysisKeys,
      staff,
      templates,
      completionItems: weeklyCompletionItems,
      reports: weeklyReports
    })
  ), [analysisKeys, staff, templates, weeklyCompletionItems, weeklyReports]);

  const analytics = useMemo(() => (
    buildTaskDeltaAnalysis({
      currentDateKey: dateKey,
      dateKeys: analysisKeys,
      staff,
      templates,
      completionItems: weeklyCompletionItems.map((item) => ({
        user_id: item.user_id,
        report_date: item.report_date,
        task_id: item.task_id,
        completed_at: item.completed_at
      })),
      reports: weeklyReports,
      overrides: alertOverrides.map((item) => ({
        user_id: item.user_id,
        report_date: item.report_date,
        task_id: item.task_id,
        is_alarming: item.is_alarming,
        reason: item.reason ?? null
      }))
    })
  ), [alertOverrides, analysisKeys, dateKey, staff, templates, weeklyCompletionItems, weeklyReports]);

  const staffById = useMemo(() => {
    const map: Record<string, StaffProfile> = {};
    staff.forEach((member) => {
      map[member.id] = member;
    });
    return map;
  }, [staff]);

  const analyticsByTask = useMemo(() => {
    const map: Record<string, TaskDeltaRow> = {};
    analytics.rows.forEach((row) => {
      map[`${row.user_id}:${row.report_date}:${row.task_id}`] = row;
    });
    return map;
  }, [analytics.rows]);

  const historicalReportSummaries = useMemo(() => (
    buildHistoricalReportSummaries({
      reports: historicalReports,
      templates,
      completions: historicalCompletionItems.map((item) => ({
        user_id: item.user_id,
        report_date: item.report_date,
        task_id: item.task_id
      })),
      customTasks: historicalCustomTasks.map((task) => ({
        id: task.id,
        report_date: task.report_date,
        title: task.title,
        estimated_minutes: task.estimated_minutes,
        is_active: task.is_active
      })),
      removals: historicalTaskRemovals.map((row) => ({
        user_id: row.user_id,
        report_date: row.report_date,
        task_id: row.task_id,
        is_removed: row.is_removed
      }))
    })
  ), [historicalReports, templates, historicalCompletionItems, historicalCustomTasks, historicalTaskRemovals]);

  useEffect(() => {
    if (historicalReportSummaries.length === 0) {
      setSelectedHistoricalReportKey(null);
      return;
    }
    setSelectedHistoricalReportKey((prev) => {
      if (!prev) return historicalReportSummaries[0].key;
      const exists = historicalReportSummaries.some((row) => row.key === prev);
      return exists ? prev : historicalReportSummaries[0].key;
    });
  }, [historicalReportSummaries]);

  const selectedHistoricalReport = useMemo(() => {
    if (historicalReportSummaries.length === 0) return null;
    return historicalReportSummaries.find((row) => row.key === selectedHistoricalReportKey) || historicalReportSummaries[0];
  }, [historicalReportSummaries, selectedHistoricalReportKey]);

  const selectedHistoricalStaff = selectedHistoricalReport
    ? staffById[selectedHistoricalReport.user_id]
    : null;

  const projectsOrdered = useMemo(() => {
    const open = projects.filter((item) => !item.is_done);
    const done = projects.filter((item) => item.is_done);
    return [...open, ...done];
  }, [projects]);
  const activeProjects = useMemo(
    () => projectsOrdered.filter((item) => !item.is_done),
    [projectsOrdered]
  );

  const missedTasksWindow = Math.max(0, windowPerformance.totals.expectedTasks - windowPerformance.totals.completedTasks);
  const missedTasksRateWindow = windowPerformance.totals.expectedTasks > 0
    ? Math.round((missedTasksWindow / windowPerformance.totals.expectedTasks) * 100)
    : 0;
  const completionRateWindow = windowPerformance.totals.expectedTasks > 0
    ? Math.round((windowPerformance.totals.completedTasks / windowPerformance.totals.expectedTasks) * 100)
    : 0;
  const overEstimateWindow = useMemo(() => (
    computeOverEstimateDays({
      dateKeys: analysisKeys,
      templates: templates.map((item) => ({
        id: item.id,
        schedule_days: item.schedule_days,
        estimated_minutes: item.estimated_minutes ?? null
      })),
      customTasks: historicalCustomTasks.map((item) => ({
        id: item.id,
        report_date: item.report_date,
        estimated_minutes: item.estimated_minutes ?? null,
        is_active: item.is_active
      })),
      removals: historicalTaskRemovals.map((row) => ({
        report_date: row.report_date,
        task_id: row.task_id,
        is_removed: row.is_removed
      })),
      reports: historicalReports.map((row) => ({
        user_id: row.user_id,
        report_date: row.report_date,
        start_time: row.start_time,
        end_time: row.end_time
      }))
    })
  ), [analysisKeys, templates, historicalCustomTasks, historicalTaskRemovals, historicalReports]);

  const managerUserId = profile?.id || '';
  const universalAgendaUserId = useMemo(
    () => resolveUniversalAgendaUserId(staff, managerUserId),
    [staff, managerUserId]
  );
  const universalAgendaEnabled = true;
  const recurringTemplatesToday = useMemo(() => {
    const dayCode = getWeekdayCode(dateKey);
    return templates
      .filter((template) => (template.schedule_days || []).includes(dayCode))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [dateKey, templates]);
  const visibleRecurringTemplatesToday = useMemo(() => (
    recurringTemplatesToday.filter((task) => !isTaskRemoved(removedTaskSet, universalAgendaUserId, dateKey, task.id))
  ), [dateKey, recurringTemplatesToday, removedTaskSet, universalAgendaUserId]);
  const universalCompletionItemsToday = useMemo(() => (
    completionItems.filter((item) => item.user_id === universalAgendaUserId && item.report_date === dateKey)
  ), [completionItems, dateKey, universalAgendaUserId]);
  const universalCompletedTaskIdsToday = useMemo(
    () => new Set(universalCompletionItemsToday.map((item) => item.task_id)),
    [universalCompletionItemsToday]
  );
  const managerCustomTasksToday = useMemo(() => (
    customTasks.filter((task) => task.report_date === dateKey && task.is_active)
  ), [customTasks, dateKey]);
  const managerCustomCompletedToday = useMemo(() => (
    managerCustomTasksToday.filter((task) => universalCompletedTaskIdsToday.has(`custom:${task.id}`)).length
  ), [universalCompletedTaskIdsToday, managerCustomTasksToday]);
  const universalTaskTotal = visibleRecurringTemplatesToday.length + managerCustomTasksToday.length;
  const universalTaskCompleted = visibleRecurringTemplatesToday.filter((task) => universalCompletedTaskIdsToday.has(task.id)).length + managerCustomCompletedToday;
  const managerDraft = customTaskDrafts[managerUserId] || { title: '', estimated_minutes: '', details: '' };
  const managerAddState = customTaskMutationState[`add:${managerUserId}`] || 'idle';

  const filteredStaff = useMemo(() => {
    if (!staffFilter.trim()) return staff;
    const needle = staffFilter.toLowerCase();
    return staff.filter((member) => {
      const label = `${member.full_name ?? ''} ${member.email ?? ''}`.toLowerCase();
      return label.includes(needle);
    });
  }, [staff, staffFilter]);

  const getTemplatesForDateKey = (key: string) => {
    const dayCode = getWeekdayCode(key);
    return templates
      .filter((template) => (template.schedule_days || []).includes(dayCode))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  };

  const getHistorySummary = (userId: string, key: string) => {
    const templatesForDay = getTemplatesForDateKey(key);
    const total = templatesForDay.length;
    const completed = (historyItemsByUser[userId] || []).filter((item) => item.report_date === key).length;
    const report = (historyReportsByUser[userId] || []).find((item) => item.report_date === key);
    return { total, completed, hasReport: !!report };
  };

  const handleToggleHistory = async (userId: string) => {
    setHistoryOpen((prev) => ({ ...prev, [userId]: !prev[userId] }));
    if (historyItemsByUser[userId]) return;

    const start = historyKeys[historyKeys.length - 1];
    const end = historyKeys[0];

    const [historyItems, historyReports] = await Promise.all([
      supabase
        .from('agenda_completion_items')
        .select('user_id, report_date, task_id, completed_at, completed_by, source')
        .eq('user_id', userId)
        .gte('report_date', start)
        .lte('report_date', end),
      supabase
        .from('agenda_reports')
        .select('user_id, report_date, did, handover, start_time, end_time')
        .eq('user_id', userId)
        .gte('report_date', start)
        .lte('report_date', end)
    ]);

    if (!historyItems.error) {
      setHistoryItemsByUser((prev) => ({ ...prev, [userId]: historyItems.data || [] }));
    }
    if (!historyReports.error) {
      setHistoryReportsByUser((prev) => ({ ...prev, [userId]: historyReports.data || [] }));
    }
  };


  const handleManagerToggleTask = async (userId: string, taskId: string, isCurrentlyCompleted: boolean) => {
    if (!profile?.id) return;

    const mutationKey = `${userId}:${dateKey}:${taskId}`;
    setTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'saving' }));

    const nowIso = new Date().toISOString();
    const action = buildCompletionItemAction({
      wasChecked: isCurrentlyCompleted,
      userId,
      actorUserId: profile.id,
      reportDate: dateKey,
      taskId,
      source: 'manager'
    });

    try {
      if (action.type === 'insert') {
        const { error: itemInsertError } = await supabase
          .from('agenda_completion_items')
          .upsert(action.payload, { onConflict: 'user_id,report_date,task_id' });
        if (itemInsertError) throw itemInsertError;
      } else {
        const { error: itemDeleteError } = await supabase
          .from('agenda_completion_items')
          .delete()
          .eq('user_id', action.selector.user_id)
          .eq('report_date', action.selector.report_date)
          .eq('task_id', action.selector.task_id);
        if (itemDeleteError) throw itemDeleteError;
      }

      const currentDayIds = completionItems
        .filter((item) => item.user_id === userId && item.report_date === dateKey)
        .map((item) => item.task_id);

      const nextCompletedIds = applyCompletedTaskToggle(currentDayIds, taskId, isCurrentlyCompleted);

      const { error: completionError } = await supabase
        .from('agenda_completions')
        .upsert({
          user_id: userId,
          report_date: dateKey,
          completed_task_ids: nextCompletedIds,
          updated_at: nowIso,
          updated_by: profile.id
        }, { onConflict: 'user_id,report_date' });
      if (completionError) throw completionError;

      setCompletionItems((prev) => {
        const withoutTask = prev.filter((item) => !(
          item.user_id === userId &&
          item.report_date === dateKey &&
          item.task_id === taskId
        ));

        if (action.type === 'delete') return withoutTask;

        return [
          ...withoutTask,
          {
            user_id: userId,
            report_date: dateKey,
            task_id: taskId,
            completed_at: nowIso,
            completed_by: profile.id,
            source: 'manager'
          }
        ];
      });

      setHistoryItemsByUser((prev) => {
        const existing = prev[userId];
        if (!existing) return prev;
        const withoutTask = existing.filter((item) => !(
          item.report_date === dateKey &&
          item.task_id === taskId
        ));
        const next = action.type === 'delete'
          ? withoutTask
          : [...withoutTask, {
              user_id: userId,
              report_date: dateKey,
              task_id: taskId,
              completed_at: nowIso,
              completed_by: profile.id,
              source: 'manager'
            }];
        return { ...prev, [userId]: next };
      });

      setTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
    } catch (err) {
      console.warn('Failed to toggle manager task', err);
      setTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'error' }));
    }
  };

  const handleSetTaskAlarm = async (row: TaskDeltaRow, isAlarming: boolean) => {
    if (!profile?.id) return;
    const key = `${row.user_id}:${row.report_date}:${row.task_id}`;
    const reason = (alertReasonDrafts[key] || '').trim();
    setAlertMutationState((prev) => ({ ...prev, [key]: 'saving' }));

    const nextOverride: ManagerAlertOverride = {
      user_id: row.user_id,
      report_date: row.report_date,
      task_id: row.task_id,
      is_alarming: isAlarming,
      reason: reason || null,
      set_by: profile.id,
      set_at: new Date().toISOString()
    };

    setAlertOverrides((prev) => {
      const without = prev.filter((item) => !(
        item.user_id === row.user_id &&
        item.report_date === row.report_date &&
        item.task_id === row.task_id
      ));
      return [nextOverride, ...without];
    });

    if (!alertOverrideSupported) {
      setAlertMutationState((prev) => ({ ...prev, [key]: 'idle' }));
      return;
    }

    const { error: overrideError } = await supabase
      .from('agenda_manager_alert_overrides')
      .upsert([{
        user_id: row.user_id,
        report_date: row.report_date,
        task_id: row.task_id,
        is_alarming: isAlarming,
        reason: reason || null,
        set_by: profile.id,
        set_at: new Date().toISOString()
      }], { onConflict: 'user_id,report_date,task_id' });

    if (overrideError) {
      console.warn('Failed to persist alert override', overrideError);
      setAlertMutationState((prev) => ({ ...prev, [key]: 'error' }));
      return;
    }

    setAlertMutationState((prev) => ({ ...prev, [key]: 'idle' }));
  };

  const handleAddCustomTask = async (userId: string) => {
    if (!profile?.id) return;
    const draft = customTaskDrafts[userId] || { title: '', estimated_minutes: '', details: '' };
    const title = draft.title.trim();
    if (!title) return;

    const estimatedMinutesRaw = draft.estimated_minutes.trim();
    const estimatedMinutes = estimatedMinutesRaw ? Number(estimatedMinutesRaw) : null;
    const safeEstimated = Number.isFinite(estimatedMinutes) && (estimatedMinutes as number) > 0
      ? Math.round(estimatedMinutes as number)
      : null;
    const details = draft.details.trim() || null;
    const mutationKey = `add:${userId}`;
    setCustomTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'saving' }));

    if (!customTasksSupported) {
      const localId = `local-${Date.now()}`;
      setCustomTasks((prev) => [...prev, {
        id: localId,
        user_id: userId,
        report_date: dateKey,
        title,
        estimated_minutes: safeEstimated,
        details,
        created_by: profile.id,
        created_at: new Date().toISOString(),
        is_active: true
      }]);
      setCustomTaskDrafts((prev) => ({ ...prev, [userId]: { title: '', estimated_minutes: '', details: '' } }));
      setCustomTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
      if (userId === managerUserId) setShowManagerAddTaskForm(false);
      return;
    }

    const { data, error: customTaskError } = await supabase
      .from('agenda_manager_custom_tasks')
      .insert([{
        user_id: userId,
        report_date: dateKey,
        title,
        estimated_minutes: safeEstimated,
        details,
        created_by: profile.id,
        is_active: true
      }])
      .select('id, user_id, report_date, title, estimated_minutes, details, created_by, created_at, is_active')
      .maybeSingle();

    if (customTaskError) {
      console.warn('Failed to add custom task', customTaskError);
      setCustomTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'error' }));
      return;
    }

    if (data) {
      setCustomTasks((prev) => [...prev, data as ManagerCustomTask]);
    }
    setCustomTaskDrafts((prev) => ({ ...prev, [userId]: { title: '', estimated_minutes: '', details: '' } }));
    setCustomTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
    if (userId === managerUserId) setShowManagerAddTaskForm(false);
  };

  const handleRemoveCustomTask = async (task: ManagerCustomTask) => {
    const mutationKey = `remove:${task.id}`;
    setCustomTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'saving' }));
    const previous = customTasks;
    setCustomTasks((prev) => prev.filter((item) => item.id !== task.id));

    if (!customTasksSupported || task.id.startsWith('local-')) {
      setCustomTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
      return;
    }

    const { error: removeError } = await supabase
      .from('agenda_manager_custom_tasks')
      .update({ is_active: false })
      .eq('id', task.id);

    if (removeError) {
      console.warn('Failed to remove custom task', removeError);
      setCustomTasks(previous);
      setCustomTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'error' }));
      return;
    }

    setCustomTaskMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
  };

  const handleSetTaskRemoved = async (userId: string, taskId: string, isRemoved: boolean) => {
    if (!profile?.id) return;
    const mutationKey = `remove-template:${userId}:${dateKey}:${taskId}`;
    setTaskRemovalMutationState((prev) => ({ ...prev, [mutationKey]: 'saving' }));

    const optimistic: ManagerTaskRemoval = {
      user_id: userId,
      report_date: dateKey,
      task_id: taskId,
      is_removed: isRemoved,
      reason: null,
      set_by: profile.id,
      set_at: new Date().toISOString()
    };

    setTaskRemovals((prev) => {
      const without = prev.filter((item) => !(
        item.user_id === userId &&
        item.report_date === dateKey &&
        item.task_id === taskId
      ));
      return [optimistic, ...without];
    });

    if (!taskRemovalsSupported) {
      setTaskRemovalMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
      return;
    }

    const { error: removalError } = await supabase
      .from('agenda_manager_task_removals')
      .upsert([{
        user_id: userId,
        report_date: dateKey,
        task_id: taskId,
        is_removed: isRemoved,
        reason: null,
        set_by: profile.id,
        set_at: new Date().toISOString()
      }], { onConflict: 'user_id,report_date,task_id' });

    if (removalError) {
      console.warn('Failed to save task removal', removalError);
      setTaskRemovalMutationState((prev) => ({ ...prev, [mutationKey]: 'error' }));
      return;
    }

    setTaskRemovalMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
  };

  const handleAddTaskNote = async (userId: string, taskId: string) => {
    if (!profile?.id) return;
    const key = `${userId}:${taskId}`;
    const note = (taskNoteDrafts[key] || '').trim();
    if (!note) return;
    setTaskNoteStatus((prev) => ({ ...prev, [key]: 'saving' }));

    const { data, error: noteError } = await supabase
      .from('agenda_manager_notes')
      .insert([{
        user_id: userId,
        report_date: dateKey,
        task_id: taskId,
        note,
        created_by: profile.id
      }])
      .select('id, user_id, report_date, task_id, note, created_by, created_at')
      .maybeSingle();

    if (noteError) {
      console.warn('Failed to add task note', noteError);
      setTaskNoteStatus((prev) => ({ ...prev, [key]: 'error' }));
      return;
    }
    if (data) {
      setNotes((prev) => [data as ManagerNote, ...prev]);
    }
    setTaskNoteDrafts((prev) => ({ ...prev, [key]: '' }));
    setTaskNoteStatus((prev) => ({ ...prev, [key]: 'idle' }));
  };

  const handleAddNote = async (userId: string) => {
    if (!profile?.id) return;
    const draft = (noteDrafts[userId] || '').trim();
    if (!draft) return;
    setNoteStatus((prev) => ({ ...prev, [userId]: 'saving' }));

    const { data, error: noteError } = await supabase
      .from('agenda_manager_notes')
      .insert([{
        user_id: userId,
        report_date: dateKey,
        task_id: null,
        note: draft,
        created_by: profile.id
      }])
      .select('id, user_id, report_date, task_id, note, created_by, created_at')
      .maybeSingle();

    if (noteError) {
      console.warn('Failed to add manager note', noteError);
      setNoteStatus((prev) => ({ ...prev, [userId]: 'error' }));
      return;
    }

    if (data) {
      setNotes((prev) => [data, ...prev]);
    }
    setNoteDrafts((prev) => ({ ...prev, [userId]: '' }));
    setNoteStatus((prev) => ({ ...prev, [userId]: 'idle' }));
  };

  const handleToggleProjectDone = async (project: AgendaProject) => {
    const mutationKey = `toggle:${project.id}`;
    const nextDone = !project.is_done;
    setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'saving' }));
    setProjects((prev) => prev.map((item) => (
      item.id === project.id ? { ...item, is_done: nextDone } : item
    )));

    if (!projectsSupported) {
      setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
      return;
    }

    const { error: updateError } = await supabase
      .from('agenda_projects')
      .update({ is_done: nextDone })
      .eq('id', project.id);

    if (updateError) {
      console.warn('Failed to toggle project', updateError);
      setProjects((prev) => prev.map((item) => (
        item.id === project.id ? { ...item, is_done: project.is_done } : item
      )));
      setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'error' }));
      return;
    }

    setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
  };

  const handleSaveProject = async (project: AgendaProject) => {
    const draft = projectDrafts[project.id] || {
      title: project.title,
      description: project.description || ''
    };
    const title = draft.title.trim();
    const description = draft.description.trim();
    if (!title) return;

    const mutationKey = `save:${project.id}`;
    setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'saving' }));
    setProjects((prev) => prev.map((item) => (
      item.id === project.id
        ? { ...item, title, description: description || null }
        : item
    )));

    if (!projectsSupported) {
      setProjectEditorOpen((prev) => ({ ...prev, [project.id]: false }));
      setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
      return;
    }

    const { error: updateError } = await supabase
      .from('agenda_projects')
      .update({
        title,
        description: description || null
      })
      .eq('id', project.id);

    if (updateError) {
      console.warn('Failed to save project', updateError);
      setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'error' }));
      return;
    }

    setProjectEditorOpen((prev) => ({ ...prev, [project.id]: false }));
    setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
  };

  const handleAddProject = async () => {
    const title = newProjectDraft.title.trim();
    const description = newProjectDraft.description.trim();
    if (!title) return;

    const mutationKey = 'add:new';
    setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'saving' }));

    const nextSortOrder = projects.reduce((max, item) => (
      Math.max(max, Number.isFinite(item.sort_order) ? item.sort_order : 0)
    ), 0) + 1;

    if (!projectsSupported) {
      const localId = `local-project-${Date.now()}`;
      setProjects((prev) => [...prev, {
        id: localId,
        title,
        description: description || null,
        sort_order: nextSortOrder,
        is_done: false,
        is_active: true
      }]);
      setNewProjectDraft({ title: '', description: '' });
      setShowAddProjectForm(false);
      setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
      return;
    }

    const { data, error: insertError } = await supabase
      .from('agenda_projects')
      .insert([{
        title,
        description: description || null,
        sort_order: nextSortOrder,
        is_done: false,
        is_active: true
      }])
      .select('id, title, description, sort_order, is_done, is_active, created_at, updated_at')
      .maybeSingle();

    if (insertError) {
      console.warn('Failed to add project', insertError);
      setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'error' }));
      return;
    }

    if (data) {
      setProjects((prev) => [...prev, data as AgendaProject]);
    }
    setNewProjectDraft({ title: '', description: '' });
    setShowAddProjectForm(false);
    setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
  };

  const handleRemoveProject = async (project: AgendaProject) => {
    const mutationKey = `remove:${project.id}`;
    const previous = projects;
    setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'saving' }));
    setProjects((prev) => prev.filter((item) => item.id !== project.id));

    if (!projectsSupported || project.id.startsWith('local-project-')) {
      setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
      return;
    }

    const { error: removeError } = await supabase
      .from('agenda_projects')
      .update({ is_active: false })
      .eq('id', project.id);

    if (removeError) {
      console.warn('Failed to remove project', removeError);
      setProjects(previous);
      setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'error' }));
      return;
    }

    setProjectMutationState((prev) => ({ ...prev, [mutationKey]: 'idle' }));
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#111111]" />
      </div>
    );
  }

  return (
    <div
      className={ui.page}
      style={{
        fontFamily: "'Google Sans Code', 'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace"
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-[#E5E7EB] border border-[#1F2937]/30 flex items-center justify-center text-[#111111]">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <p className={ui.label}>Manager</p>
            <h1 className="text-3xl md:text-4xl font-black text-[#111111]">Dagsagenda</h1>
            <p className={ui.body}>Idag ({dateKey})</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-400/40 bg-rose-100/70 p-4 text-rose-800 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">
          {[1, 7, 30].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setAnalysisWindowDays(days as 1 | 7 | 30)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-[0.2em] ${
                analysisWindowDays === days
                  ? 'border-[#111111] bg-[#111111] text-white'
                  : 'border-[#9CA3AF] bg-white text-[#374151]'
              }`}
            >
              {days === 1 ? '1 dag' : `${days} dagar`}
            </button>
          ))}
          <div className="text-[11px] text-[#374151] self-center">
            Intervall: {analysisKeys[analysisKeys.length - 1]} - {dateKey}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
        <div className="rounded-2xl border border-[#9CA3AF] bg-white xl:order-3 h-full flex flex-col">
          <button
            type="button"
            onClick={() => setSectionOpen((prev) => ({ ...prev, overview: !prev.overview }))}
            className="w-full px-5 py-4 min-h-[84px] flex items-center justify-between text-left"
          >
            <h2 className="text-[28px] leading-none font-black text-[#111111]">Status</h2>
            <ChevronDown className={`w-5 h-5 text-[#111111] transition-transform ${sectionOpen.overview ? 'rotate-180' : ''}`} />
          </button>
          {sectionOpen.overview && (
            <div className="border-t border-[#E5E7EB] p-5 flex-1">
              <ul className="space-y-2 text-sm text-[#111111]">
                <li><span className="font-semibold">Slutförandegrad:</span> {completionRateWindow}%</li>
                <li><span className="font-semibold">Missade uppgifter:</span> {missedTasksRateWindow}%</li>
                <li><span className="font-semibold">Dagar över estimat:</span> {overEstimateWindow.overEstimatePct}%</li>
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#9CA3AF] bg-white xl:order-1 h-full flex flex-col">
          <button
            type="button"
            onClick={() => setSectionOpen((prev) => ({ ...prev, staff: !prev.staff }))}
            className="w-full px-5 py-4 min-h-[84px] flex items-center justify-between text-left"
          >
            <h2 className="text-[28px] leading-none font-black text-[#111111]">Dagsagenda</h2>
            <ChevronDown className={`w-5 h-5 text-[#111111] transition-transform ${sectionOpen.staff ? 'rotate-180' : ''}`} />
          </button>
          {sectionOpen.staff && (
            <div className="border-t border-[#E5E7EB] p-5 flex-1">
              {universalAgendaEnabled ? (
                <div className="space-y-4">
                  <ul className="space-y-2 text-sm text-[#111111]">
                    <li><span className="font-semibold">Dagsagenda:</span> {universalTaskCompleted}/{universalTaskTotal} slutförda</li>
                    <li><span className="font-semibold">Datum:</span> {dateKey}</li>
                  </ul>

                  <ul className="space-y-1 text-[14px] text-[#111111]">
                    {visibleRecurringTemplatesToday.map((task) => {
                      const taskId = task.id;
                      const completion = universalCompletionItemsToday.find((item) => item.task_id === taskId);
                      const isCompleted = Boolean(completion);
                      const taskMutationKey = `${universalAgendaUserId}:${dateKey}:${taskId}`;
                      const taskMutation = taskMutationState[taskMutationKey] || 'idle';
                      const taskRemovalKey = `remove-template:${universalAgendaUserId}:${dateKey}:${taskId}`;
                      const taskRemovalState = taskRemovalMutationState[taskRemovalKey] || 'idle';
                      return (
                        <li key={task.id} className="flex items-start justify-between gap-3">
                          <div className={`min-w-0 ${isCompleted ? 'line-through text-[#4B5563]' : 'text-[#111111]'}`}>
                            - {task.title}
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleSetTaskRemoved(universalAgendaUserId, taskId, true)}
                              disabled={!universalAgendaUserId || taskRemovalState === 'saving'}
                              className="text-[11px] font-semibold text-[#4B5563] hover:text-[#111111] disabled:opacity-50"
                            >
                              {taskRemovalState === 'saving' ? 'Tar bort...' : 'Ta bort'}
                            </button>
                            <button
                              type="button"
                              aria-label={isCompleted ? `Markera ${task.title} som ej klar` : `Markera ${task.title} som klar`}
                              onClick={() => handleManagerToggleTask(universalAgendaUserId, taskId, isCompleted)}
                              disabled={!universalAgendaUserId || taskMutation === 'saving'}
                              className="text-[18px] leading-none font-black text-[#111111] disabled:opacity-50"
                            >
                              {isCompleted ? '✓' : '○'}
                            </button>
                          </div>
                        </li>
                      );
                    })}

                    {managerCustomTasksToday.map((task) => {
                      const taskId = `custom:${task.id}`;
                      const completion = universalCompletionItemsToday.find((item) => item.task_id === taskId);
                      const isCompleted = Boolean(completion);
                      const taskMutationKey = `${universalAgendaUserId}:${dateKey}:${taskId}`;
                      const taskMutation = taskMutationState[taskMutationKey] || 'idle';
                      const removeState = customTaskMutationState[`remove:${task.id}`] || 'idle';
                      const detailsExpanded = !!expandedTaskDetails[taskId];
                      return (
                        <li key={task.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div className={`min-w-0 ${isCompleted ? 'line-through text-[#4B5563]' : 'text-[#111111]'}`}>- {task.title}</div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleRemoveCustomTask(task)}
                                disabled={removeState === 'saving'}
                                className="text-[11px] font-semibold text-[#4B5563] hover:text-[#111111] disabled:opacity-50"
                              >
                                {removeState === 'saving' ? 'Tar bort...' : 'Ta bort'}
                              </button>
                              <button
                              type="button"
                              aria-label={isCompleted ? `Markera ${task.title} som ej klar` : `Markera ${task.title} som klar`}
                              onClick={() => handleManagerToggleTask(universalAgendaUserId, taskId, isCompleted)}
                              disabled={!universalAgendaUserId || taskMutation === 'saving'}
                              className="text-[18px] leading-none font-black text-[#111111] disabled:opacity-50"
                            >
                              {isCompleted ? '✓' : '○'}
                              </button>
                            </div>
                          </div>
                          {task.details && (
                            <div className="mt-1 ml-3 text-[11px] text-[#4B5563]">
                              {detailsExpanded ? task.details : truncateText(task.details, 120)}
                              {task.details.length > 120 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedTaskDetails((prev) => ({ ...prev, [taskId]: !prev[taskId] }))}
                                  className="ml-2 font-semibold text-[#111111] hover:underline"
                                >
                                  {detailsExpanded ? 'Visa mindre' : 'Läs mer'}
                                </button>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}

                    {(visibleRecurringTemplatesToday.length + managerCustomTasksToday.length) === 0 && (
                      <li className="text-sm text-[#4B5563]">Inga schemalagda uppgifter idag.</li>
                    )}
                  </ul>

                  <button
                    type="button"
                    onClick={() => setShowManagerAddTaskForm((prev) => !prev)}
                    className="text-sm font-semibold text-[#111111] hover:underline"
                  >
                    {showManagerAddTaskForm ? 'Stäng ny uppgift' : 'Lägg till ny uppgift'}
                  </button>

                  {showManagerAddTaskForm && (
                    <div className="rounded-xl border border-[#D1D5DB] bg-white/80 p-3 space-y-2">
                      <input
                        value={managerDraft.title}
                        onChange={(event) => setCustomTaskDrafts((prev) => ({
                          ...prev,
                          [managerUserId]: { ...managerDraft, title: event.target.value }
                        }))}
                        placeholder="Uppgiftstitel"
                        className="w-full rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[12px]"
                      />
                      <input
                        value={managerDraft.estimated_minutes}
                        onChange={(event) => setCustomTaskDrafts((prev) => ({
                          ...prev,
                          [managerUserId]: { ...managerDraft, estimated_minutes: event.target.value }
                        }))}
                        placeholder="Estimerad tid (minuter)"
                        className="w-full rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[12px]"
                      />
                      <textarea
                        value={managerDraft.details}
                        onChange={(event) => setCustomTaskDrafts((prev) => ({
                          ...prev,
                          [managerUserId]: { ...managerDraft, details: event.target.value }
                        }))}
                        placeholder="Kort kontext (valfritt)"
                        className="w-full rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[12px] min-h-[56px]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomTask(managerUserId)}
                        disabled={!managerUserId || managerAddState === 'saving'}
                        className="text-sm font-semibold text-[#111111] hover:underline disabled:opacity-50"
                      >
                        {managerAddState === 'saving' ? 'Sparar...' : 'Spara uppgift'}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
              <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#374151] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={staffFilter}
                    onChange={(event) => setStaffFilter(event.target.value)}
                    placeholder="Filtrera personal..."
                    className="w-full pl-9 pr-3 py-3 rounded-2xl border border-[#9CA3AF] bg-white text-sm text-[#111111]"
                  />
                </div>
                <div className="text-xs font-black uppercase tracking-[0.25em] text-[#374151]">{filteredStaff.length} personal</div>
              </div>

              <div className="space-y-4">
          {filteredStaff.length === 0 && (
            <div className={ui.card}>Ingen personal matchar filtret.</div>
          )}

          {filteredStaff.map((member) => {
            const summary = dailySummary.byUser[member.id];
            const report = reportsByUser[member.id];
            const isExpanded = !!expandedStaff[member.id];
            const userNotes = notesByUserDate[member.id]?.[dateKey] || [];
            const generalUserNotes = userNotes.filter((note) => !note.task_id);
            const noteValue = noteDrafts[member.id] || '';
            const noteState = noteStatus[member.id] || 'idle';
            const performance = weeklyPerformance.byUser[member.id];
            const memberCustomTasks = customTasks.filter((task) => task.user_id === member.id && task.report_date === dateKey && task.is_active);
            const memberCustomCompleted = memberCustomTasks.filter((task) => completionItems.some((item) => (
              item.user_id === member.id && item.report_date === dateKey && item.task_id === `custom:${task.id}`
            ))).length;
            const baseTasks = summary?.tasks || [];
            const visibleBaseTasks = baseTasks.filter((task) => !isTaskRemoved(removedTaskSet, member.id, dateKey, task.task_id));
            const removedBaseTasks = baseTasks.filter((task) => isTaskRemoved(removedTaskSet, member.id, dateKey, task.task_id));
            const totalTaskCount = visibleBaseTasks.length + memberCustomTasks.length;
            const completedTaskCount = visibleBaseTasks.filter((task) => task.is_completed).length + memberCustomCompleted;
            const customDraft = customTaskDrafts[member.id] || { title: '', estimated_minutes: '', details: '' };
            const addState = customTaskMutationState[`add:${member.id}`] || 'idle';

            return (
              <div key={member.id} className="rounded-2xl border border-[#9CA3AF] bg-white">
                <button
                  type="button"
                  onClick={() => setExpandedStaff((prev) => ({ ...prev, [member.id]: !prev[member.id] }))}
                  className="w-full text-left px-5 py-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-black text-[#111111]">{member.full_name || member.email}</div>
                    <div className="text-xs text-[#374151]">{member.email}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-[#374151]">
                      {completedTaskCount}/{totalTaskCount} uppgifter
                    </div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-[#4B5563]">
                      Vecka {performance?.adherencePct ?? 0}%
                    </div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-[#4B5563]">
                      Rapport {performance?.reportCoveragePct ?? 0}%
                    </div>
                    {(performance?.slowTasks || 0) > 0 && (
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-rose-400/40 text-rose-700 bg-rose-50">
                        Långsam {performance?.slowTasks}
                      </div>
                    )}
                    <div className="text-xs text-[#4B5563]">Senast: {formatTime(summary?.last_completed_at ?? null)}</div>
                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${report ? 'border-emerald-400/40 text-emerald-700 bg-emerald-50' : 'border-amber-400/40 text-amber-700 bg-amber-50'}`}>
                      {report ? 'Rapport' : 'Ingen rapport'}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#374151] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && summary && (
                  <div className="border-t border-[#E5E7EB] px-5 py-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className={ui.label}>Uppgifter idag</div>
                        <div className="mt-3 space-y-2">
                          {visibleBaseTasks.map((task) => {
                            const taskMutationKey = `${member.id}:${dateKey}:${task.task_id}`;
                            const taskMutation = taskMutationState[taskMutationKey] || 'idle';
                            const taskRemovalKey = `remove-template:${member.id}:${dateKey}:${task.task_id}`;
                            const taskRemovalState = taskRemovalMutationState[taskRemovalKey] || 'idle';
                            const taskAnalytics = analyticsByTask[`${member.id}:${dateKey}:${task.task_id}`];
                            const overrideKey = `${member.id}:${dateKey}:${task.task_id}`;
                            const alertState = alertMutationState[overrideKey] || 'idle';
                            const taskNotes = userNotes.filter((note) => note.task_id === task.task_id);
                            const taskNoteKey = `${member.id}:${task.task_id}`;
                            const taskNoteValue = taskNoteDrafts[taskNoteKey] || '';
                            const taskNoteMutation = taskNoteStatus[taskNoteKey] || 'idle';
                            return (
                              <div key={task.task_id} className="space-y-2">
                                <div className="flex items-center justify-between rounded-xl border border-[#D1D5DB] bg-[#F9FAFB]/70 px-3 py-2">
                                  <div>
                                    <div className="text-sm font-bold text-[#111111]">{task.title}</div>
                                    <div className="text-[11px] text-[#374151]">
                                      {task.is_completed ? `Klarmarkerad ${formatTime(task.completed_at)}` : 'Ej klarmarkerad'}
                                    </div>
                                    <div className="text-[11px] text-[#374151]">
                                      Delta: {taskAnalytics?.delta_minutes === null || taskAnalytics?.delta_minutes === undefined ? '—' : `${taskAnalytics.delta_minutes} min`} · Förväntad {taskAnalytics ? formatTime(taskAnalytics.expected_completed_at) : '—'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {task.requires_quality_check && (
                                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${task.is_completed ? 'border-emerald-400/40 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-500 bg-slate-50'}`}>
                                        Kvalitetscheck {task.is_completed ? 'klar' : 'saknas'}
                                      </span>
                                    )}
                                    {task.is_completed && task.completion_source === 'manager' && (
                                      <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-cyan-400/40 text-cyan-700 bg-cyan-50">
                                        Manager
                                      </span>
                                    )}
                                    {task.is_slow && (
                                      <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-rose-400/40 text-rose-700 bg-rose-50">
                                        Lång tid
                                      </span>
                                    )}
                                    {taskAnalytics && (
                                      <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${
                                        taskAnalytics.final_level === 'critical'
                                          ? 'border-rose-400/40 text-rose-700 bg-rose-50'
                                          : taskAnalytics.final_level === 'warning'
                                            ? 'border-amber-400/40 text-amber-700 bg-amber-50'
                                            : taskAnalytics.final_level === 'missing'
                                              ? 'border-slate-400/40 text-slate-700 bg-slate-100'
                                              : 'border-emerald-400/40 text-emerald-700 bg-emerald-50'
                                      }`}>
                                        {taskAnalytics.final_level}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleManagerToggleTask(member.id, task.task_id, task.is_completed)}
                                      disabled={taskMutation === 'saving'}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border transition disabled:opacity-60 ${task.is_completed ? 'border-rose-400/40 text-rose-700 bg-rose-50 hover:border-rose-500/60' : 'border-emerald-400/40 text-emerald-700 bg-emerald-50 hover:border-emerald-500/60'}`}
                                    >
                                      {taskMutation === 'saving' ? 'Sparar...' : task.is_completed ? 'Ångra' : 'Klarmarkera'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSetTaskRemoved(member.id, task.task_id, true)}
                                      disabled={taskRemovalState === 'saving'}
                                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-slate-400/40 text-slate-700 bg-slate-100"
                                    >
                                      {taskRemovalState === 'saving' ? 'Tar bort...' : 'Ta bort'}
                                    </button>
                                    {taskAnalytics && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleSetTaskAlarm(taskAnalytics, true)}
                                          disabled={alertState === 'saving'}
                                          className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-rose-400/40 text-rose-700 bg-rose-50"
                                        >
                                          Alarm
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleSetTaskAlarm(taskAnalytics, false)}
                                          disabled={alertState === 'saving'}
                                          className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-emerald-400/40 text-emerald-700 bg-emerald-50"
                                        >
                                          Ej alarm
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {taskAnalytics && (
                                  <input
                                    value={alertReasonDrafts[overrideKey] ?? taskAnalytics.manager_reason ?? ''}
                                    onChange={(event) => setAlertReasonDrafts((prev) => ({ ...prev, [overrideKey]: event.target.value }))}
                                    placeholder="Managerkommentar till alarmbeslut..."
                                    className="w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-[11px] text-[#111111]"
                                  />
                                )}
                                <div className="rounded-lg border border-[#D1D5DB] bg-white/80 p-2 space-y-2">
                                  {taskNotes.slice(0, 2).map((note) => (
                                    <div key={note.id} className="text-[11px] text-[#4B5563]">
                                      {note.note}
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={taskNoteValue}
                                      onChange={(event) => setTaskNoteDrafts((prev) => ({ ...prev, [taskNoteKey]: event.target.value }))}
                                      placeholder="Kommentar till uppgift..."
                                      className="flex-1 rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[11px]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddTaskNote(member.id, task.task_id)}
                                      disabled={taskNoteMutation === 'saving'}
                                      className="px-2 py-1 rounded-md border border-[#111111]/40 bg-[#111111]/10 text-[#111111] text-[10px] font-black uppercase tracking-[0.15em]"
                                    >
                                      {taskNoteMutation === 'saving' ? 'Sparar' : 'Spara'}
                                    </button>
                                  </div>
                                </div>
                                {taskMutation === 'error' && (
                                  <div className="text-[11px] text-rose-600 font-bold px-1">
                                    Kunde inte uppdatera uppgiften. Försök igen.
                                  </div>
                                )}
                                {alertState === 'error' && (
                                  <div className="text-[11px] text-rose-600 font-bold px-1">
                                    Kunde inte spara alarmbeslut. Försök igen.
                                  </div>
                                )}
                                {taskNoteMutation === 'error' && (
                                  <div className="text-[11px] text-rose-600 font-bold px-1">
                                    Kunde inte spara uppgiftskommentar.
                                  </div>
                                )}
                                {taskRemovalState === 'error' && (
                                  <div className="text-[11px] text-rose-600 font-bold px-1">
                                    Kunde inte ta bort uppgift.
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {removedBaseTasks.length > 0 && (
                            <div className="rounded-xl border border-[#D1D5DB] bg-[#F9FAFB]/60 p-3 space-y-2">
                              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#374151]">Borttagna idag</div>
                              {removedBaseTasks.map((task) => {
                                const taskRemovalKey = `remove-template:${member.id}:${dateKey}:${task.task_id}`;
                                const taskRemovalState = taskRemovalMutationState[taskRemovalKey] || 'idle';
                                return (
                                  <div key={`removed-${task.task_id}`} className="flex items-center justify-between rounded-lg border border-[#9CA3AF] bg-white px-3 py-2">
                                    <div className="text-[11px] text-[#4B5563]">{task.title}</div>
                                    <button
                                      type="button"
                                      onClick={() => handleSetTaskRemoved(member.id, task.task_id, false)}
                                      disabled={taskRemovalState === 'saving'}
                                      className="px-2 py-1 rounded-md border border-[#111111]/40 bg-[#111111]/10 text-[#111111] text-[10px] font-black uppercase tracking-[0.15em]"
                                    >
                                      {taskRemovalState === 'saving' ? 'Sparar...' : 'Återställ'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {memberCustomTasks.map((task) => {
                            const taskId = `custom:${task.id}`;
                            const completion = completionItems.find((item) => (
                              item.user_id === member.id &&
                              item.report_date === dateKey &&
                              item.task_id === taskId
                            ));
                            const isCompleted = Boolean(completion);
                            const taskMutationKey = `${member.id}:${dateKey}:${taskId}`;
                            const taskMutation = taskMutationState[taskMutationKey] || 'idle';
                            const taskNotes = userNotes.filter((note) => note.task_id === taskId);
                            const taskNoteKey = `${member.id}:${taskId}`;
                            const taskNoteValue = taskNoteDrafts[taskNoteKey] || '';
                            const taskNoteMutation = taskNoteStatus[taskNoteKey] || 'idle';
                            const detailsExpanded = !!expandedTaskDetails[taskId];
                            const removeState = customTaskMutationState[`remove:${task.id}`] || 'idle';
                            return (
                              <div key={task.id} className="space-y-2">
                                <div className="flex items-center justify-between rounded-xl border border-[#D8E7BE] bg-[#F0F7DF] px-3 py-2">
                                  <div>
                                    <div className="text-sm font-bold text-[#111111]">{task.title}</div>
                                    <div className="text-[11px] text-[#374151]">
                                      Extra uppgift {task.estimated_minutes ? `· Est ${task.estimated_minutes} min` : ''} · {isCompleted ? `Klarmarkerad ${formatTime(completion?.completed_at)}` : 'Ej klarmarkerad'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-[#111111]/40 text-[#111111] bg-[#111111]/10">
                                      Extra
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleManagerToggleTask(member.id, taskId, isCompleted)}
                                      disabled={taskMutation === 'saving'}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border transition disabled:opacity-60 ${isCompleted ? 'border-rose-400/40 text-rose-700 bg-rose-50 hover:border-rose-500/60' : 'border-emerald-400/40 text-emerald-700 bg-emerald-50 hover:border-emerald-500/60'}`}
                                    >
                                      {taskMutation === 'saving' ? 'Sparar...' : isCompleted ? 'Ångra' : 'Klarmarkera'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCustomTask(task)}
                                      disabled={removeState === 'saving'}
                                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-slate-400/40 text-slate-700 bg-slate-100"
                                    >
                                      {removeState === 'saving' ? 'Tar bort...' : 'Ta bort'}
                                    </button>
                                  </div>
                                </div>
                                {task.details && (
                                  <div className="rounded-lg border border-[#D1D5DB] bg-white/80 p-2 text-[11px] text-[#4B5563]">
                                    {detailsExpanded ? task.details : truncateText(task.details, 110)}
                                    {task.details.length > 110 && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedTaskDetails((prev) => ({ ...prev, [taskId]: !prev[taskId] }))}
                                        className="ml-2 text-[#111111] font-black uppercase tracking-[0.12em]"
                                      >
                                        {detailsExpanded ? 'Visa mindre' : 'Läs mer'}
                                      </button>
                                    )}
                                  </div>
                                )}
                                <div className="rounded-lg border border-[#D1D5DB] bg-white/80 p-2 space-y-2">
                                  {taskNotes.slice(0, 2).map((note) => (
                                    <div key={note.id} className="text-[11px] text-[#4B5563]">
                                      {note.note}
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={taskNoteValue}
                                      onChange={(event) => setTaskNoteDrafts((prev) => ({ ...prev, [taskNoteKey]: event.target.value }))}
                                      placeholder="Kommentar till extra uppgift..."
                                      className="flex-1 rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[11px]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddTaskNote(member.id, taskId)}
                                      disabled={taskNoteMutation === 'saving'}
                                      className="px-2 py-1 rounded-md border border-[#111111]/40 bg-[#111111]/10 text-[#111111] text-[10px] font-black uppercase tracking-[0.15em]"
                                    >
                                      {taskNoteMutation === 'saving' ? 'Sparar' : 'Spara'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {(visibleBaseTasks.length + memberCustomTasks.length) === 0 && (
                            <div className="text-sm text-[#374151]">Inga schemalagda uppgifter idag.</div>
                          )}
                          <div className="rounded-xl border border-[#D1D5DB] bg-white/80 p-3 space-y-2">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#374151]">Lägg till uppgift (manager)</div>
                            {!customTasksSupported && (
                              <div className="text-[11px] text-amber-700">Databas-tabell saknas. Extra uppgifter sparas bara lokalt tills SQL körs.</div>
                            )}
                            {!taskRemovalsSupported && (
                              <div className="text-[11px] text-amber-700">Databas-tabell för borttagna uppgifter saknas. Ta bort/återställ sparas bara lokalt tills SQL körs.</div>
                            )}
                            <input
                              value={customDraft.title}
                              onChange={(event) => setCustomTaskDrafts((prev) => ({
                                ...prev,
                                [member.id]: { ...customDraft, title: event.target.value }
                              }))}
                              placeholder="Uppgiftstitel"
                              className="w-full rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[11px]"
                            />
                            <input
                              value={customDraft.estimated_minutes}
                              onChange={(event) => setCustomTaskDrafts((prev) => ({
                                ...prev,
                                [member.id]: { ...customDraft, estimated_minutes: event.target.value }
                              }))}
                              placeholder="Estimerad tid i minuter (valfritt)"
                              className="w-full rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[11px]"
                            />
                            <textarea
                              value={customDraft.details}
                              onChange={(event) => setCustomTaskDrafts((prev) => ({
                                ...prev,
                                [member.id]: { ...customDraft, details: event.target.value }
                              }))}
                              placeholder="Kontext / instruktion (visas i Läs mer)"
                              className="w-full rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[11px] min-h-[64px]"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddCustomTask(member.id)}
                              disabled={addState === 'saving'}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-[#111111]/40 text-[#111111] bg-[#111111]/10"
                            >
                              {addState === 'saving' ? 'Sparar...' : 'Lägg till'}
                            </button>
                            {addState === 'error' && (
                              <div className="text-[11px] text-rose-600 font-bold">Kunde inte lägga till uppgift.</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className={ui.label}>Rapport</div>
                        <div className="mt-3 rounded-xl border border-[#D1D5DB] bg-[#F9FAFB]/70 p-3 text-sm text-[#4B5563] space-y-2">
                          {report ? (
                            <>
                              <div><strong>Start:</strong> {report.start_time || '—'} &nbsp; <strong>Slut:</strong> {report.end_time || '—'}</div>
                              <div><strong>Gjort:</strong> {report.did || '—'}</div>
                              <div><strong>Handover:</strong> {report.handover || '—'}</div>
                            </>
                          ) : (
                            <div>Ingen rapport inskickad idag.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className={ui.label}>Noteringar</div>
                      <div className="mt-3 space-y-2">
                        {generalUserNotes.length === 0 && (
                          <div className="text-sm text-[#374151]">Inga noteringar idag.</div>
                        )}
                        {generalUserNotes.map((note) => (
                          <div key={note.id} className="rounded-xl border border-[#D1D5DB] bg-[#F9FAFB]/70 p-3 text-sm text-[#4B5563]">
                            <div>{note.note}</div>
                            <div className="text-[11px] text-[#374151] mt-1">{formatTime(note.created_at)}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        <textarea
                          value={noteValue}
                          onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [member.id]: event.target.value }))}
                          placeholder="Lägg till notering..."
                          className="w-full rounded-xl border border-[#D1D5DB] bg-white/80 px-3 py-2 text-sm text-[#111111] min-h-[80px]"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleAddNote(member.id)}
                            disabled={noteState === 'saving'}
                            className="px-4 py-2 rounded-xl bg-[#111111] text-[#F9FAFB] text-xs font-black uppercase tracking-widest disabled:opacity-60"
                          >
                            {noteState === 'saving' ? 'Sparar...' : 'Spara notering'}
                          </button>
                          {noteState === 'error' && (
                            <span className="text-xs text-rose-600 font-bold">Kunde inte spara.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className={ui.label}>Historik</div>
                      <button
                        type="button"
                        onClick={() => handleToggleHistory(member.id)}
                        className="text-[10px] font-black uppercase tracking-[0.3em] text-[#4B5563]"
                      >
                        {historyOpen[member.id] ? 'Dölj historik' : 'Visa historik'}
                      </button>
                    </div>

                    {historyOpen[member.id] && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {historyKeys.map((key) => {
                          const history = getHistorySummary(member.id, key);
                          return (
                            <div key={key} className="rounded-xl border border-[#D1D5DB] bg-white/70 p-3">
                              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#374151]">{key}</div>
                              <div className="mt-2 text-sm text-[#111111]">
                                {history.completed}/{history.total} klara
                              </div>
                              <div className={`mt-2 text-[10px] font-black uppercase tracking-[0.2em] ${history.hasReport ? 'text-emerald-700' : 'text-amber-700'}`}>
                                {history.hasReport ? 'Rapport' : 'Ingen rapport'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
              </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#9CA3AF] bg-white xl:order-2 h-full flex flex-col">
            <button
              type="button"
              onClick={() => setSectionOpen((prev) => ({ ...prev, projects: !prev.projects }))}
              className="w-full px-5 py-4 min-h-[84px] flex items-center justify-between text-left"
            >
              <h2 className="text-[28px] leading-none font-black text-[#111111]">Projekt</h2>
              <ChevronDown className={`w-5 h-5 text-[#111111] transition-transform ${sectionOpen.projects ? 'rotate-180' : ''}`} />
            </button>
            {sectionOpen.projects && (
              <div className="border-t border-[#E5E7EB] p-5 flex-1">
                <div className="space-y-4">
                  <ul className="space-y-2 text-sm text-[#111111]">
                    <li className="flex items-center justify-between gap-3">
                      <span className="font-semibold">Aktiva projekt ({activeProjects.length})</span>
                      <button
                        type="button"
                        onClick={() => setActiveProjectsExpanded((prev) => !prev)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#111111] hover:underline"
                      >
                        {activeProjectsExpanded ? 'Dölj' : 'Visa'}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${activeProjectsExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </li>
                    <li><span className="font-semibold">Slutförda:</span> {projectsOrdered.filter((item) => item.is_done).length}</li>
                  </ul>

                  {!projectsSupported && (
                    <div className="text-[11px] text-amber-700">
                      Databas-tabellen för projekt saknas. Ändringar sparas bara lokalt tills SQL körs.
                    </div>
                  )}

                  {activeProjectsExpanded && (
                    <ul className="space-y-2 text-sm text-[#111111]">
                    {activeProjects.map((project) => {
                      const isEditing = !!projectEditorOpen[project.id];
                      const isDetailsOpen = !!projectDetailsOpen[project.id];
                      const draft = projectDrafts[project.id] || {
                        title: project.title,
                        description: project.description || ''
                      };
                      const toggleState = projectMutationState[`toggle:${project.id}`] || 'idle';
                      const saveState = projectMutationState[`save:${project.id}`] || 'idle';
                      const removeState = projectMutationState[`remove:${project.id}`] || 'idle';

                      return (
                        <li key={project.id} className="pb-2 border-b border-[#D1D5DB] last:border-b-0">
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                value={draft.title}
                                onChange={(event) => setProjectDrafts((prev) => ({
                                  ...prev,
                                  [project.id]: { ...draft, title: event.target.value }
                                }))}
                                placeholder="Projekttitel"
                                className="w-full rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[12px]"
                              />
                              <textarea
                                value={draft.description}
                                onChange={(event) => setProjectDrafts((prev) => ({
                                  ...prev,
                                  [project.id]: { ...draft, description: event.target.value }
                                }))}
                                placeholder="Kommentar / kontext"
                                className="w-full rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[12px] min-h-[56px]"
                              />
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleSaveProject(project)}
                                  disabled={saveState === 'saving'}
                                  className="text-[11px] font-semibold text-[#111111] hover:underline disabled:opacity-50"
                                >
                                  {saveState === 'saving' ? 'Sparar...' : 'Spara'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setProjectEditorOpen((prev) => ({ ...prev, [project.id]: false }))}
                                  className="text-[11px] font-semibold text-[#4B5563] hover:underline"
                                >
                                  Avbryt
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-start justify-between gap-3">
                                <div className={`font-semibold ${project.is_done ? 'line-through text-[#374151]' : 'text-[#111111]'}`}>
                                  <span className="text-[13px]">{project.title}</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={project.is_done}
                                  onChange={() => handleToggleProjectDone(project)}
                                  disabled={toggleState === 'saving'}
                                  className="h-4 w-4 mt-0.5 accent-[#111111]"
                                />
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px]">
                                <button
                                  type="button"
                                  onClick={() => setProjectDetailsOpen((prev) => ({ ...prev, [project.id]: !prev[project.id] }))}
                                  className="font-semibold text-[#111111] hover:underline"
                                >
                                  {isDetailsOpen ? 'Dölj kommentar' : 'Visa kommentar'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProjectDrafts((prev) => ({
                                      ...prev,
                                      [project.id]: {
                                        title: project.title,
                                        description: project.description || ''
                                      }
                                    }));
                                    setProjectEditorOpen((prev) => ({ ...prev, [project.id]: true }));
                                  }}
                                  className="font-semibold text-[#111111] hover:underline"
                                >
                                  Redigera
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProject(project)}
                                  disabled={removeState === 'saving'}
                                  className="font-semibold text-[#4B5563] hover:text-[#111111] hover:underline disabled:opacity-50"
                                  >
                                    {removeState === 'saving' ? 'Tar bort...' : 'Ta bort'}
                                  </button>
                              </div>
                              {isDetailsOpen && (
                                <div className="mt-1 text-[13px] text-[#4B5563] whitespace-pre-wrap">
                                  {project.description?.trim() || 'Ingen kommentar registrerad.'}
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                    {activeProjects.length === 0 && (
                      <li className="text-sm text-[#374151]">Inga aktiva projekt.</li>
                    )}
                  </ul>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowAddProjectForm((prev) => !prev)}
                    className="text-sm font-semibold text-[#111111] hover:underline"
                  >
                    {showAddProjectForm ? 'Stäng nytt projekt' : 'Lägg till nytt projekt'}
                  </button>

                  {showAddProjectForm && (
                    <div className="space-y-2 pl-0.5">
                      <input
                        value={newProjectDraft.title}
                        onChange={(event) => setNewProjectDraft((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="Projekttitel"
                        className="w-full rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[12px]"
                      />
                      <textarea
                        value={newProjectDraft.description}
                        onChange={(event) => setNewProjectDraft((prev) => ({ ...prev, description: event.target.value }))}
                        placeholder="Kommentar / kontext"
                        className="w-full rounded-md border border-[#9CA3AF] bg-white px-2 py-1 text-[12px] min-h-[56px]"
                      />
                      <button
                        type="button"
                        onClick={handleAddProject}
                        disabled={projectMutationState['add:new'] === 'saving'}
                        className="text-sm font-semibold text-[#111111] hover:underline disabled:opacity-50"
                      >
                        {projectMutationState['add:new'] === 'saving' ? 'Sparar...' : 'Spara projekt'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 mb-8">
          <div className="rounded-2xl border border-[#9CA3AF] bg-white">
            <button
              type="button"
              onClick={() => setSectionOpen((prev) => ({ ...prev, reports: !prev.reports }))}
              className="w-full px-5 py-4 flex items-center justify-between text-left"
            >
              <div>
                <div className={ui.label}>Historiska rapporter (klickbar rubrik)</div>
                <div className="text-sm text-[#4B5563]">Alla inskickade rapporter i hela historiken med status per dag.</div>
              </div>
              <ChevronDown className={`w-5 h-5 text-[#374151] transition-transform ${sectionOpen.reports ? 'rotate-180' : ''}`} />
            </button>
            {sectionOpen.reports && (
              <div className="border-t border-[#E5E7EB] p-5">
                <div className="text-xs text-[#374151] mb-3">
                  Rapporttäckning: {analytics.totals.report_coverage_pct}% ({analytics.totals.report_days}/{analytics.totals.expected_report_days} dagar)
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] gap-4">
                  <div className="space-y-3 text-sm text-[#4B5563] max-h-[520px] overflow-auto pr-1">
                    {historicalReportSummaries.length === 0 && <div>Inga historiska rapporter ännu.</div>}
                    {historicalReportSummaries.map((report) => {
                      const staffMember = staffById[report.user_id];
                      const isSelected = selectedHistoricalReport?.key === report.key;
                      const statusMeta = getHistoricalStatusMeta(report.status);
                      return (
                        <button
                          key={report.key}
                          type="button"
                          onClick={() => setSelectedHistoricalReportKey(report.key)}
                          className={`w-full rounded-xl border p-3 text-left transition ${isSelected ? 'border-[#111111]/70 bg-[#E5E7EB]' : 'border-[#D1D5DB] bg-[#F9FAFB]/70 hover:border-[#111111]/40'}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold text-[#111111]">{staffMember?.full_name || staffMember?.email || report.user_id}</div>
                              <div className="text-[11px] text-[#374151]">
                                {report.report_date} · Start {report.start_time || '—'} · Slut {report.end_time || '—'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
                              <span className={`px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.15em] ${statusMeta.badge}`}>
                                {statusMeta.label}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px]">
                            <span className="text-[#374151]">Slutförda / planerade</span>
                            <span className="font-black text-[#111111]">{report.completionLabel}</span>
                          </div>
                          <div className="mt-2"><strong>Gjort:</strong> {truncateText(report.did, 110)}</div>
                          <div><strong>Handover:</strong> {truncateText(report.handover, 110)}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-[#D1D5DB] bg-white/80 p-4">
                    {!selectedHistoricalReport ? (
                      <div className="text-sm text-[#374151]">Välj en rapport för att se detaljer.</div>
                    ) : (
                      <div className="space-y-4 text-sm text-[#4B5563]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className={ui.label}>Vald rapport</div>
                            <h3 className="mt-1 text-lg font-black text-[#111111]">
                              {selectedHistoricalStaff?.full_name || selectedHistoricalStaff?.email || selectedHistoricalReport.user_id}
                            </h3>
                            <div className="text-[11px] text-[#374151]">{selectedHistoricalReport.report_date}</div>
                          </div>
                          {(() => {
                            const statusMeta = getHistoricalStatusMeta(selectedHistoricalReport.status);
                            return (
                              <div className="flex items-center gap-2">
                                <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusMeta.dot}`} />
                                <span className={`px-2 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.15em] ${statusMeta.badge}`}>
                                  {statusMeta.label}
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB]/70 p-2">
                            <div className={ui.label}>Start</div>
                            <div className="mt-1 text-sm font-bold text-[#111111]">{selectedHistoricalReport.start_time || '—'}</div>
                          </div>
                          <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB]/70 p-2">
                            <div className={ui.label}>Slut</div>
                            <div className="mt-1 text-sm font-bold text-[#111111]">{selectedHistoricalReport.end_time || '—'}</div>
                          </div>
                          <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB]/70 p-2 col-span-2">
                            <div className={ui.label}>Slutförda / planerade</div>
                            <div className="mt-1 text-sm font-bold text-[#111111]">
                              {selectedHistoricalReport.completedCount}/{selectedHistoricalReport.plannedCount}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB]/70 p-3">
                          <div className={ui.label}>Gjort</div>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-[#111111]">
                            {selectedHistoricalReport.did?.trim() || 'Ingen text inskickad.'}
                          </div>
                        </div>

                        <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB]/70 p-3">
                          <div className={ui.label}>Handover</div>
                          <div className="mt-2 whitespace-pre-wrap text-sm text-[#111111]">
                            {selectedHistoricalReport.handover?.trim() || 'Ingen handover inskickad.'}
                          </div>
                        </div>

                        <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB]/70 p-3">
                          <div className={ui.label}>Planerade uppgifter</div>
                          <div className="mt-2 space-y-2">
                            {selectedHistoricalReport.plannedTasks.length === 0 && (
                              <div className="text-[12px] text-[#374151]">Ingen planerad uppgift för denna dag.</div>
                            )}
                            {selectedHistoricalReport.plannedTasks.map((task) => (
                              <div key={task.id} className="flex items-start justify-between gap-3 rounded-md border border-[#D1D5DB] bg-white px-2 py-1.5">
                                <div>
                                  <div className="text-[12px] font-semibold text-[#111111]">{task.title}</div>
                                  <div className="text-[10px] text-[#374151] uppercase tracking-[0.12em]">
                                    {task.kind === 'custom' ? 'Extra uppgift' : 'Återkommande uppgift'}
                                    {task.estimatedMinutes ? ` · Est ${task.estimatedMinutes} min` : ''}
                                  </div>
                                </div>
                                <span className={`inline-block h-2.5 w-2.5 mt-1 rounded-full ${task.isCompleted ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
