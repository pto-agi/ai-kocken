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
import { formatWindowDaysLabel } from '../utils/managerWindow';

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

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm'
  });
};

const truncateText = (value: string | null | undefined, max = 120) => {
  if (!value) return '—';
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}…`;
};

const ui = {
  page: 'min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-20 pt-24 px-4',
  card: 'rounded-2xl border border-[#DAD1C5] bg-white p-5',
  label: 'text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]',
  body: 'text-sm text-[#6B6158]'
};

type StaffProfile = { id: string; full_name?: string | null; email?: string | null; is_staff?: boolean | null };

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

type SubmissionEntry = {
  id: string;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
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
  const [startSubmissions, setStartSubmissions] = useState<SubmissionEntry[]>([]);
  const [uppSubmissions, setUppSubmissions] = useState<SubmissionEntry[]>([]);
  const [rangeStartSubmissions, setRangeStartSubmissions] = useState<SubmissionEntry[]>([]);
  const [rangeUppSubmissions, setRangeUppSubmissions] = useState<SubmissionEntry[]>([]);
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
  const [alertOverrides, setAlertOverrides] = useState<ManagerAlertOverride[]>([]);
  const [alertOverrideSupported, setAlertOverrideSupported] = useState(true);
  const [alertMutationState, setAlertMutationState] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});
  const [alertReasonDrafts, setAlertReasonDrafts] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteStatus, setNoteStatus] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});
  const [staffFilter, setStaffFilter] = useState('');
  const [analysisWindowDays, setAnalysisWindowDays] = useState<1 | 7 | 30>(7);
  const [sectionOpen, setSectionOpen] = useState<Record<'overview' | 'reports' | 'submissions' | 'staff', boolean>>({
    overview: true,
    reports: true,
    submissions: true,
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
    if (!isSupabaseConfigured()) return;
    let active = true;
    const load = async () => {
      setStatus('loading');
      setError(null);
      try {
        const dayStart = `${dateKey}T00:00:00`;
        const nextDay = new Date(`${dateKey}T00:00:00`);
        nextDay.setDate(nextDay.getDate() + 1);
        const dayEnd = `${formatDateKey(nextDay)}T00:00:00`;
        const rangeStart = dataKeys[dataKeys.length - 1] || dateKey;
        const rangeStartTs = `${rangeStart}T00:00:00`;

        const [staffRes, templateRes, completionRes, reportRes, startRes, uppRes, rangeStartRes, rangeUppRes, notesRes, weeklyCompletionRes, weeklyReportRes, historicalReportsRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email, is_staff').eq('is_staff', true),
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
            .from('startformular')
            .select('id, created_at, first_name, last_name, email')
            .gte('created_at', dayStart)
            .lt('created_at', dayEnd)
            .order('created_at', { ascending: false }),
          supabase
            .from('uppfoljningar')
            .select('id, created_at, first_name, last_name, email')
            .gte('created_at', dayStart)
            .lt('created_at', dayEnd)
            .order('created_at', { ascending: false }),
          supabase
            .from('startformular')
            .select('id, created_at, first_name, last_name, email')
            .gte('created_at', rangeStartTs)
            .lt('created_at', dayEnd)
            .order('created_at', { ascending: false }),
          supabase
            .from('uppfoljningar')
            .select('id, created_at, first_name, last_name, email')
            .gte('created_at', rangeStartTs)
            .lt('created_at', dayEnd)
            .order('created_at', { ascending: false }),
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
            .gte('report_date', rangeStart)
            .lte('report_date', dateKey)
            .order('report_date', { ascending: false })
        ]);

        if (staffRes.error) throw staffRes.error;
        if (templateRes.error) throw templateRes.error;
        if (completionRes.error) throw completionRes.error;
        if (reportRes.error) throw reportRes.error;
        if (startRes.error) throw startRes.error;
        if (uppRes.error) throw uppRes.error;
        if (rangeStartRes.error) throw rangeStartRes.error;
        if (rangeUppRes.error) throw rangeUppRes.error;
        if (notesRes.error) throw notesRes.error;
        if (weeklyCompletionRes.error) throw weeklyCompletionRes.error;
        if (weeklyReportRes.error) throw weeklyReportRes.error;
        if (historicalReportsRes.error) throw historicalReportsRes.error;
        if (!active) return;

        setStaff(staffRes.data || []);
        setTemplates(templateRes.data || []);
        setCompletionItems(completionRes.data || []);
        setReports(reportRes.data || []);
        setStartSubmissions(startRes.data || []);
        setUppSubmissions(uppRes.data || []);
        setRangeStartSubmissions(rangeStartRes.data || []);
        setRangeUppSubmissions(rangeUppRes.data || []);
        setNotes(notesRes.data || []);
        setWeeklyCompletionItems((weeklyCompletionRes.data || []) as CompletionItem[]);
        setWeeklyReports((weeklyReportRes.data || []) as WeeklyReport[]);
        setHistoricalReports((historicalReportsRes.data || []) as AgendaReport[]);

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
        } else {
          setCustomTasksSupported(true);
          setCustomTasks((customTasksRes.data || []) as ManagerCustomTask[]);
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
        } else {
          setTaskRemovalsSupported(true);
          setTaskRemovals((taskRemovalRes.data || []) as ManagerTaskRemoval[]);
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

  const analysisDateSet = useMemo(() => new Set(analysisKeys), [analysisKeys]);

  const historicalReportsInWindow = useMemo(() => (
    historicalReports.filter((report) => analysisDateSet.has(report.report_date))
  ), [analysisDateSet, historicalReports]);

  const startSubmissionsInWindow = useMemo(() => (
    rangeStartSubmissions.filter((item) => {
      const key = formatDateKey(new Date(item.created_at));
      return analysisDateSet.has(key);
    })
  ), [analysisDateSet, rangeStartSubmissions]);

  const uppSubmissionsInWindow = useMemo(() => (
    rangeUppSubmissions.filter((item) => {
      const key = formatDateKey(new Date(item.created_at));
      return analysisDateSet.has(key);
    })
  ), [analysisDateSet, rangeUppSubmissions]);

  const analysisWindowLabel = formatWindowDaysLabel(analysisWindowDays);
  const submissionsInRangeTotal = startSubmissionsInWindow.length + uppSubmissionsInWindow.length;
  const completedTasksWindow = windowPerformance.totals.completedTasks;
  const missedTasksWindow = Math.max(0, windowPerformance.totals.expectedTasks - windowPerformance.totals.completedTasks);
  const completionRateWindow = windowPerformance.totals.expectedTasks > 0
    ? Math.round((windowPerformance.totals.completedTasks / windowPerformance.totals.expectedTasks) * 100)
    : 0;

  const managerUserId = profile?.id || '';
  const universalAgendaEnabled = true;
  const recurringTemplatesToday = useMemo(() => {
    const dayCode = getWeekdayCode(dateKey);
    return templates
      .filter((template) => (template.schedule_days || []).includes(dayCode))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [dateKey, templates]);
  const visibleRecurringTemplatesToday = useMemo(() => (
    recurringTemplatesToday.filter((task) => !isTaskRemoved(removedTaskSet, managerUserId, dateKey, task.id))
  ), [dateKey, managerUserId, recurringTemplatesToday, removedTaskSet]);
  const removedRecurringTemplatesToday = useMemo(() => (
    recurringTemplatesToday.filter((task) => isTaskRemoved(removedTaskSet, managerUserId, dateKey, task.id))
  ), [dateKey, managerUserId, recurringTemplatesToday, removedTaskSet]);
  const managerCompletionItemsToday = useMemo(() => (
    completionItems.filter((item) => item.user_id === managerUserId && item.report_date === dateKey)
  ), [completionItems, dateKey, managerUserId]);
  const managerCompletedTaskIdsToday = useMemo(
    () => new Set(managerCompletionItemsToday.map((item) => item.task_id)),
    [managerCompletionItemsToday]
  );
  const managerCustomTasksToday = useMemo(() => (
    customTasks.filter((task) => task.report_date === dateKey && task.is_active)
  ), [customTasks, dateKey]);
  const managerCustomCompletedToday = useMemo(() => (
    managerCustomTasksToday.filter((task) => managerCompletedTaskIdsToday.has(`custom:${task.id}`)).length
  ), [managerCompletedTaskIdsToday, managerCustomTasksToday]);
  const universalTaskTotal = visibleRecurringTemplatesToday.length + managerCustomTasksToday.length;
  const universalTaskCompleted = visibleRecurringTemplatesToday.filter((task) => managerCompletedTaskIdsToday.has(task.id)).length + managerCustomCompletedToday;
  const managerDraft = customTaskDrafts[managerUserId] || { title: '', estimated_minutes: '', details: '' };
  const managerAddState = customTaskMutationState[`add:${managerUserId}`] || 'idle';
  const notesForToday = useMemo(() => notes.filter((note) => note.report_date === dateKey), [dateKey, notes]);

  const totals = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    Object.entries(dailySummary.byUser).forEach(([userId, summary]) => {
      const visibleTasks = summary.tasks.filter((task) => !isTaskRemoved(removedTaskSet, userId, dateKey, task.task_id));
      totalTasks += visibleTasks.length;
      completedTasks += visibleTasks.filter((task) => task.is_completed).length;
    });
    return { totalTasks, completedTasks };
  }, [dailySummary, removedTaskSet, dateKey]);

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

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#a0c81d]" />
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <p className={ui.label}>Manager</p>
            <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D]">Dagsagenda</h1>
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
                  ? 'border-[#a0c81d] bg-[#a0c81d]/15 text-[#556b0b]'
                  : 'border-[#DAD1C5] bg-white text-[#6B6158]'
              }`}
            >
              {days === 1 ? '1 dag' : `${days} dagar`}
            </button>
          ))}
          <div className="text-[11px] text-[#8A8177] self-center">
            Intervall: {analysisKeys[analysisKeys.length - 1]} - {dateKey}
          </div>
        </div>

        <div className="flex flex-col">
        <div className="order-1 mb-8 rounded-2xl border border-[#DAD1C5] bg-white">
          <button
            type="button"
            onClick={() => setSectionOpen((prev) => ({ ...prev, overview: !prev.overview }))}
            className="w-full px-5 py-4 flex items-center justify-between text-left"
          >
            <div>
              <div className={ui.label}>Analysöversikt (klickbar rubrik)</div>
              <div className="text-sm text-[#6B6158]">KPI: avvikelser, täckning, kritiska uppgifter och snittdelta.</div>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#8A8177] transition-transform ${sectionOpen.overview ? 'rotate-180' : ''}`} />
          </button>
          {sectionOpen.overview && (
            <div className="border-t border-[#EFE7DC] p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={ui.card}>
                  <div className={ui.label}>Klarmarkerat idag</div>
                  <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{totals.completedTasks}</div>
                </div>
                <div className={ui.card}>
                  <div className={ui.label}>Totala uppgifter idag</div>
                  <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{totals.totalTasks}</div>
                </div>
                <div className={ui.card}>
                  <div className={ui.label}>Rapporter idag</div>
                  <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{reports.length}</div>
                </div>
                <div className={ui.card}>
                  <div className={ui.label}>Inlämningar idag</div>
                  <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{startSubmissions.length + uppSubmissions.length}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={ui.card}>
                  <div className={ui.label}>Slutförda uppgifter ({analysisWindowLabel})</div>
                  <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{completedTasksWindow}</div>
                </div>
                <div className={ui.card}>
                  <div className={ui.label}>Missade uppgifter ({analysisWindowLabel})</div>
                  <div className="mt-2 text-3xl font-black text-rose-700">{missedTasksWindow}</div>
                </div>
                <div className={ui.card}>
                  <div className={ui.label}>Slutförandegrad ({analysisWindowLabel})</div>
                  <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{completionRateWindow}%</div>
                </div>
                <div className={ui.card}>
                  <div className={ui.label}>Veckoföljsamhet ({analysisWindowLabel})</div>
                  <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{windowPerformance.totals.adherencePct}%</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="order-2 mb-6 rounded-2xl border border-[#DAD1C5] bg-white">
          <button
            type="button"
            onClick={() => setSectionOpen((prev) => ({ ...prev, staff: !prev.staff }))}
            className="w-full px-5 py-4 flex items-center justify-between text-left"
          >
            <div>
              <div className={ui.label}>Avvikelseanalys (dagsagenda-hanterare)</div>
              <div className="text-sm text-[#6B6158]">Universell dagsagenda som todo-lista med avvikelser, kommentarer och snabb redigering.</div>
            </div>
            <ChevronDown className={`w-5 h-5 text-[#8A8177] transition-transform ${sectionOpen.staff ? 'rotate-180' : ''}`} />
          </button>
          {sectionOpen.staff && (
            <div className="border-t border-[#EFE7DC] p-5">
              {universalAgendaEnabled ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-4 py-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-[#8A8177]">Dagsagenda</p>
                      <h3 className="text-lg font-black text-[#3D3D3D]">{universalTaskCompleted}/{universalTaskTotal} klara</h3>
                    </div>
                    <div className="text-[11px] text-[#8A8177]">Datum {dateKey}</div>
                  </div>

                  <div className="space-y-2">
                    {visibleRecurringTemplatesToday.map((task) => {
                      const taskId = task.id;
                      const completion = managerCompletionItemsToday.find((item) => item.task_id === taskId);
                      const isCompleted = Boolean(completion);
                      const taskMutationKey = `${managerUserId}:${dateKey}:${taskId}`;
                      const taskMutation = taskMutationState[taskMutationKey] || 'idle';
                      const taskRemovalKey = `remove-template:${managerUserId}:${dateKey}:${taskId}`;
                      const taskRemovalState = taskRemovalMutationState[taskRemovalKey] || 'idle';
                      const taskNotes = notesForToday.filter((note) => note.task_id === taskId);
                      const taskNoteKey = `${managerUserId}:${taskId}`;
                      const taskNoteValue = taskNoteDrafts[taskNoteKey] || '';
                      const taskNoteMutation = taskNoteStatus[taskNoteKey] || 'idle';
                      return (
                        <div key={task.id} className="rounded-xl border border-[#E6E1D8] bg-white/80 p-3 space-y-2">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              onChange={() => handleManagerToggleTask(managerUserId, taskId, isCompleted)}
                              disabled={!managerUserId || taskMutation === 'saving'}
                              className="mt-1 accent-[#a0c81d]"
                            />
                            <div className="flex-1">
                              <div className={`text-sm font-semibold ${isCompleted ? 'line-through text-[#8A8177]' : 'text-[#3D3D3D]'}`}>
                                {task.title}
                              </div>
                              <div className="text-[11px] text-[#8A8177] mt-1 flex items-center gap-2">
                                <span>{isCompleted ? `Klarmarkerad ${formatTime(completion?.completed_at)}` : 'Ej klarmarkerad'}</span>
                                {task.estimated_minutes && (
                                  <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] border border-[#E6E1D8] rounded-full px-2 py-0.5 bg-white/80">
                                    {task.estimated_minutes} min
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSetTaskRemoved(managerUserId, taskId, true)}
                              disabled={!managerUserId || taskRemovalState === 'saving'}
                              className="px-2 py-1 rounded-md border border-slate-400/40 text-slate-700 bg-slate-100 text-[10px] font-black uppercase tracking-[0.15em]"
                            >
                              {taskRemovalState === 'saving' ? 'Tar bort...' : 'Ta bort'}
                            </button>
                          </div>
                          <div className="rounded-lg border border-[#E6E1D8] bg-white p-2 space-y-1">
                            {taskNotes.slice(0, 2).map((note) => (
                              <div key={note.id} className="text-[11px] text-[#6B6158]">
                                {note.note}
                              </div>
                            ))}
                            <div className="flex items-center gap-2">
                              <input
                                value={taskNoteValue}
                                onChange={(event) => setTaskNoteDrafts((prev) => ({ ...prev, [taskNoteKey]: event.target.value }))}
                                placeholder="Kommentar till uppgift..."
                                className="flex-1 rounded-md border border-[#DAD1C5] bg-white px-2 py-1 text-[11px]"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddTaskNote(managerUserId, taskId)}
                                disabled={!managerUserId || taskNoteMutation === 'saving'}
                                className="px-2 py-1 rounded-md border border-[#a0c81d]/40 bg-[#a0c81d]/10 text-[#556b0b] text-[10px] font-black uppercase tracking-[0.15em]"
                              >
                                {taskNoteMutation === 'saving' ? 'Sparar' : 'Spara'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {managerCustomTasksToday.map((task) => {
                      const taskId = `custom:${task.id}`;
                      const completion = managerCompletionItemsToday.find((item) => item.task_id === taskId);
                      const isCompleted = Boolean(completion);
                      const taskMutationKey = `${managerUserId}:${dateKey}:${taskId}`;
                      const taskMutation = taskMutationState[taskMutationKey] || 'idle';
                      const removeState = customTaskMutationState[`remove:${task.id}`] || 'idle';
                      const taskNotes = notesForToday.filter((note) => note.task_id === taskId);
                      const taskNoteKey = `${managerUserId}:${taskId}`;
                      const taskNoteValue = taskNoteDrafts[taskNoteKey] || '';
                      const taskNoteMutation = taskNoteStatus[taskNoteKey] || 'idle';
                      const detailsExpanded = !!expandedTaskDetails[taskId];
                      return (
                        <div key={task.id} className="rounded-xl border border-[#D8E7BE] bg-[#F0F7DF] p-3 space-y-2">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isCompleted}
                              onChange={() => handleManagerToggleTask(managerUserId, taskId, isCompleted)}
                              disabled={!managerUserId || taskMutation === 'saving'}
                              className="mt-1 accent-[#a0c81d]"
                            />
                            <div className="flex-1">
                              <div className={`text-sm font-semibold ${isCompleted ? 'line-through text-[#8A8177]' : 'text-[#3D3D3D]'}`}>{task.title}</div>
                              <div className="text-[11px] text-[#8A8177] mt-1">
                                Extra uppgift {task.estimated_minutes ? `· Est ${task.estimated_minutes} min` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomTask(task)}
                              disabled={removeState === 'saving'}
                              className="px-2 py-1 rounded-md border border-slate-400/40 text-slate-700 bg-slate-100 text-[10px] font-black uppercase tracking-[0.15em]"
                            >
                              {removeState === 'saving' ? 'Tar bort...' : 'Ta bort'}
                            </button>
                          </div>
                          {task.details && (
                            <div className="text-[11px] text-[#6B6158] rounded-lg border border-[#E6E1D8] bg-white p-2">
                              {detailsExpanded ? task.details : truncateText(task.details, 110)}
                              {task.details.length > 110 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedTaskDetails((prev) => ({ ...prev, [taskId]: !prev[taskId] }))}
                                  className="ml-2 text-[#556b0b] font-black uppercase tracking-[0.12em]"
                                >
                                  {detailsExpanded ? 'Visa mindre' : 'Läs mer'}
                                </button>
                              )}
                            </div>
                          )}
                          <div className="rounded-lg border border-[#E6E1D8] bg-white p-2 space-y-1">
                            {taskNotes.slice(0, 2).map((note) => (
                              <div key={note.id} className="text-[11px] text-[#6B6158]">
                                {note.note}
                              </div>
                            ))}
                            <div className="flex items-center gap-2">
                              <input
                                value={taskNoteValue}
                                onChange={(event) => setTaskNoteDrafts((prev) => ({ ...prev, [taskNoteKey]: event.target.value }))}
                                placeholder="Kommentar till uppgift..."
                                className="flex-1 rounded-md border border-[#DAD1C5] bg-white px-2 py-1 text-[11px]"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddTaskNote(managerUserId, taskId)}
                                disabled={!managerUserId || taskNoteMutation === 'saving'}
                                className="px-2 py-1 rounded-md border border-[#a0c81d]/40 bg-[#a0c81d]/10 text-[#556b0b] text-[10px] font-black uppercase tracking-[0.15em]"
                              >
                                {taskNoteMutation === 'saving' ? 'Sparar' : 'Spara'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {removedRecurringTemplatesToday.length > 0 && (
                      <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-3 space-y-2">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8A8177]">Borttagna idag</div>
                        {removedRecurringTemplatesToday.map((task) => {
                          const taskRemovalKey = `remove-template:${managerUserId}:${dateKey}:${task.id}`;
                          const taskRemovalState = taskRemovalMutationState[taskRemovalKey] || 'idle';
                          return (
                            <div key={`removed-${task.id}`} className="flex items-center justify-between rounded-lg border border-[#DAD1C5] bg-white px-3 py-2">
                              <div className="text-[11px] text-[#6B6158]">{task.title}</div>
                              <button
                                type="button"
                                onClick={() => handleSetTaskRemoved(managerUserId, task.id, false)}
                                disabled={!managerUserId || taskRemovalState === 'saving'}
                                className="px-2 py-1 rounded-md border border-[#a0c81d]/40 bg-[#a0c81d]/10 text-[#556b0b] text-[10px] font-black uppercase tracking-[0.15em]"
                              >
                                {taskRemovalState === 'saving' ? 'Sparar...' : 'Återställ'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="rounded-xl border border-[#E6E1D8] bg-white/80 p-3 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8A8177]">Lägg till uppgift</div>
                      {!customTasksSupported && (
                        <div className="text-[11px] text-amber-700">Databas-tabell saknas. Extra uppgifter sparas bara lokalt tills SQL körs.</div>
                      )}
                      {!taskRemovalsSupported && (
                        <div className="text-[11px] text-amber-700">Databas-tabell för borttagna uppgifter saknas. Ta bort/återställ sparas bara lokalt tills SQL körs.</div>
                      )}
                      <input
                        value={managerDraft.title}
                        onChange={(event) => setCustomTaskDrafts((prev) => ({
                          ...prev,
                          [managerUserId]: { ...managerDraft, title: event.target.value }
                        }))}
                        placeholder="Uppgiftstitel"
                        className="w-full rounded-md border border-[#DAD1C5] bg-white px-2 py-1 text-[11px]"
                      />
                      <textarea
                        value={managerDraft.details}
                        onChange={(event) => setCustomTaskDrafts((prev) => ({
                          ...prev,
                          [managerUserId]: { ...managerDraft, details: event.target.value }
                        }))}
                        placeholder="Kommentar / kontext (Läs mer)"
                        className="w-full rounded-md border border-[#DAD1C5] bg-white px-2 py-1 text-[11px] min-h-[64px]"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomTask(managerUserId)}
                        disabled={!managerUserId || managerAddState === 'saving'}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-[#a0c81d]/40 text-[#556b0b] bg-[#a0c81d]/10"
                      >
                        {managerAddState === 'saving' ? 'Sparar...' : 'Lägg till'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
              <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#8A8177] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={staffFilter}
                    onChange={(event) => setStaffFilter(event.target.value)}
                    placeholder="Filtrera personal..."
                    className="w-full pl-9 pr-3 py-3 rounded-2xl border border-[#DAD1C5] bg-white text-sm text-[#3D3D3D]"
                  />
                </div>
                <div className="text-xs font-black uppercase tracking-[0.25em] text-[#8A8177]">{filteredStaff.length} personal</div>
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
              <div key={member.id} className="rounded-2xl border border-[#DAD1C5] bg-white">
                <button
                  type="button"
                  onClick={() => setExpandedStaff((prev) => ({ ...prev, [member.id]: !prev[member.id] }))}
                  className="w-full text-left px-5 py-4 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm font-black text-[#3D3D3D]">{member.full_name || member.email}</div>
                    <div className="text-xs text-[#8A8177]">{member.email}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-[#8A8177]">
                      {completedTaskCount}/{totalTaskCount} uppgifter
                    </div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-[#6B6158]">
                      Vecka {performance?.adherencePct ?? 0}%
                    </div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-[#6B6158]">
                      Rapport {performance?.reportCoveragePct ?? 0}%
                    </div>
                    {(performance?.slowTasks || 0) > 0 && (
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-rose-400/40 text-rose-700 bg-rose-50">
                        Långsam {performance?.slowTasks}
                      </div>
                    )}
                    <div className="text-xs text-[#6B6158]">Senast: {formatTime(summary?.last_completed_at ?? null)}</div>
                    <div className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border ${report ? 'border-emerald-400/40 text-emerald-700 bg-emerald-50' : 'border-amber-400/40 text-amber-700 bg-amber-50'}`}>
                      {report ? 'Rapport' : 'Ingen rapport'}
                    </div>
                    <ChevronDown className={`w-5 h-5 text-[#8A8177] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && summary && (
                  <div className="border-t border-[#EFE7DC] px-5 py-4 space-y-4">
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
                                <div className="flex items-center justify-between rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-3 py-2">
                                  <div>
                                    <div className="text-sm font-bold text-[#3D3D3D]">{task.title}</div>
                                    <div className="text-[11px] text-[#8A8177]">
                                      {task.is_completed ? `Klarmarkerad ${formatTime(task.completed_at)}` : 'Ej klarmarkerad'}
                                    </div>
                                    <div className="text-[11px] text-[#8A8177]">
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
                                    className="w-full rounded-lg border border-[#E6E1D8] bg-white px-3 py-2 text-[11px] text-[#3D3D3D]"
                                  />
                                )}
                                <div className="rounded-lg border border-[#E6E1D8] bg-white/80 p-2 space-y-2">
                                  {taskNotes.slice(0, 2).map((note) => (
                                    <div key={note.id} className="text-[11px] text-[#6B6158]">
                                      {note.note}
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={taskNoteValue}
                                      onChange={(event) => setTaskNoteDrafts((prev) => ({ ...prev, [taskNoteKey]: event.target.value }))}
                                      placeholder="Kommentar till uppgift..."
                                      className="flex-1 rounded-md border border-[#DAD1C5] bg-white px-2 py-1 text-[11px]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddTaskNote(member.id, task.task_id)}
                                      disabled={taskNoteMutation === 'saving'}
                                      className="px-2 py-1 rounded-md border border-[#a0c81d]/40 bg-[#a0c81d]/10 text-[#556b0b] text-[10px] font-black uppercase tracking-[0.15em]"
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
                            <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-3 space-y-2">
                              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8A8177]">Borttagna idag</div>
                              {removedBaseTasks.map((task) => {
                                const taskRemovalKey = `remove-template:${member.id}:${dateKey}:${task.task_id}`;
                                const taskRemovalState = taskRemovalMutationState[taskRemovalKey] || 'idle';
                                return (
                                  <div key={`removed-${task.task_id}`} className="flex items-center justify-between rounded-lg border border-[#DAD1C5] bg-white px-3 py-2">
                                    <div className="text-[11px] text-[#6B6158]">{task.title}</div>
                                    <button
                                      type="button"
                                      onClick={() => handleSetTaskRemoved(member.id, task.task_id, false)}
                                      disabled={taskRemovalState === 'saving'}
                                      className="px-2 py-1 rounded-md border border-[#a0c81d]/40 bg-[#a0c81d]/10 text-[#556b0b] text-[10px] font-black uppercase tracking-[0.15em]"
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
                                    <div className="text-sm font-bold text-[#3D3D3D]">{task.title}</div>
                                    <div className="text-[11px] text-[#8A8177]">
                                      Extra uppgift {task.estimated_minutes ? `· Est ${task.estimated_minutes} min` : ''} · {isCompleted ? `Klarmarkerad ${formatTime(completion?.completed_at)}` : 'Ej klarmarkerad'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-[#a0c81d]/40 text-[#556b0b] bg-[#a0c81d]/10">
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
                                  <div className="rounded-lg border border-[#E6E1D8] bg-white/80 p-2 text-[11px] text-[#6B6158]">
                                    {detailsExpanded ? task.details : truncateText(task.details, 110)}
                                    {task.details.length > 110 && (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedTaskDetails((prev) => ({ ...prev, [taskId]: !prev[taskId] }))}
                                        className="ml-2 text-[#556b0b] font-black uppercase tracking-[0.12em]"
                                      >
                                        {detailsExpanded ? 'Visa mindre' : 'Läs mer'}
                                      </button>
                                    )}
                                  </div>
                                )}
                                <div className="rounded-lg border border-[#E6E1D8] bg-white/80 p-2 space-y-2">
                                  {taskNotes.slice(0, 2).map((note) => (
                                    <div key={note.id} className="text-[11px] text-[#6B6158]">
                                      {note.note}
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-2">
                                    <input
                                      value={taskNoteValue}
                                      onChange={(event) => setTaskNoteDrafts((prev) => ({ ...prev, [taskNoteKey]: event.target.value }))}
                                      placeholder="Kommentar till extra uppgift..."
                                      className="flex-1 rounded-md border border-[#DAD1C5] bg-white px-2 py-1 text-[11px]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddTaskNote(member.id, taskId)}
                                      disabled={taskNoteMutation === 'saving'}
                                      className="px-2 py-1 rounded-md border border-[#a0c81d]/40 bg-[#a0c81d]/10 text-[#556b0b] text-[10px] font-black uppercase tracking-[0.15em]"
                                    >
                                      {taskNoteMutation === 'saving' ? 'Sparar' : 'Spara'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {(visibleBaseTasks.length + memberCustomTasks.length) === 0 && (
                            <div className="text-sm text-[#8A8177]">Inga schemalagda uppgifter idag.</div>
                          )}
                          <div className="rounded-xl border border-[#E6E1D8] bg-white/80 p-3 space-y-2">
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8A8177]">Lägg till uppgift (manager)</div>
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
                              className="w-full rounded-md border border-[#DAD1C5] bg-white px-2 py-1 text-[11px]"
                            />
                            <input
                              value={customDraft.estimated_minutes}
                              onChange={(event) => setCustomTaskDrafts((prev) => ({
                                ...prev,
                                [member.id]: { ...customDraft, estimated_minutes: event.target.value }
                              }))}
                              placeholder="Estimerad tid i minuter (valfritt)"
                              className="w-full rounded-md border border-[#DAD1C5] bg-white px-2 py-1 text-[11px]"
                            />
                            <textarea
                              value={customDraft.details}
                              onChange={(event) => setCustomTaskDrafts((prev) => ({
                                ...prev,
                                [member.id]: { ...customDraft, details: event.target.value }
                              }))}
                              placeholder="Kontext / instruktion (visas i Läs mer)"
                              className="w-full rounded-md border border-[#DAD1C5] bg-white px-2 py-1 text-[11px] min-h-[64px]"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddCustomTask(member.id)}
                              disabled={addState === 'saving'}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-[#a0c81d]/40 text-[#556b0b] bg-[#a0c81d]/10"
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
                        <div className="mt-3 rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3 text-sm text-[#6B6158] space-y-2">
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
                          <div className="text-sm text-[#8A8177]">Inga noteringar idag.</div>
                        )}
                        {generalUserNotes.map((note) => (
                          <div key={note.id} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3 text-sm text-[#6B6158]">
                            <div>{note.note}</div>
                            <div className="text-[11px] text-[#8A8177] mt-1">{formatTime(note.created_at)}</div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        <textarea
                          value={noteValue}
                          onChange={(event) => setNoteDrafts((prev) => ({ ...prev, [member.id]: event.target.value }))}
                          placeholder="Lägg till notering..."
                          className="w-full rounded-xl border border-[#E6E1D8] bg-white/80 px-3 py-2 text-sm text-[#3D3D3D] min-h-[80px]"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleAddNote(member.id)}
                            disabled={noteState === 'saving'}
                            className="px-4 py-2 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest disabled:opacity-60"
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
                        className="text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158]"
                      >
                        {historyOpen[member.id] ? 'Dölj historik' : 'Visa historik'}
                      </button>
                    </div>

                    {historyOpen[member.id] && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {historyKeys.map((key) => {
                          const history = getHistorySummary(member.id, key);
                          return (
                            <div key={key} className="rounded-xl border border-[#E6E1D8] bg-white/70 p-3">
                              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8A8177]">{key}</div>
                              <div className="mt-2 text-sm text-[#3D3D3D]">
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

        <div className="order-3 grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10 mb-8">
          <div className="rounded-2xl border border-[#DAD1C5] bg-white">
            <button
              type="button"
              onClick={() => setSectionOpen((prev) => ({ ...prev, reports: !prev.reports }))}
              className="w-full px-5 py-4 flex items-center justify-between text-left"
            >
              <div>
                <div className={ui.label}>Historiska rapporter (klickbar rubrik)</div>
                <div className="text-sm text-[#6B6158]">Alla inskickade rapporter inom valt intervall.</div>
              </div>
              <ChevronDown className={`w-5 h-5 text-[#8A8177] transition-transform ${sectionOpen.reports ? 'rotate-180' : ''}`} />
            </button>
            {sectionOpen.reports && (
              <div className="border-t border-[#EFE7DC] p-5">
                <div className="text-xs text-[#8A8177] mb-3">
                  Rapporttäckning: {analytics.totals.report_coverage_pct}% ({analytics.totals.report_days}/{analytics.totals.expected_report_days} dagar)
                </div>
                <div className="space-y-3 text-sm text-[#6B6158] max-h-[420px] overflow-auto pr-1">
                  {historicalReportsInWindow.length === 0 && <div>Inga rapporter i valt intervall.</div>}
                  {historicalReportsInWindow.map((report, index) => {
                    const staffMember = staffById[report.user_id];
                    return (
                      <div key={`${report.user_id}:${report.report_date}:${index}`} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                        <div className="text-sm font-bold text-[#3D3D3D]">{staffMember?.full_name || staffMember?.email || report.user_id}</div>
                        <div className="text-[11px] text-[#8A8177]">{report.report_date} · Start {report.start_time || '—'} · Slut {report.end_time || '—'}</div>
                        <div className="mt-2"><strong>Gjort:</strong> {truncateText(report.did, 180)}</div>
                        <div><strong>Handover:</strong> {truncateText(report.handover, 180)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#DAD1C5] bg-white">
            <button
              type="button"
              onClick={() => setSectionOpen((prev) => ({ ...prev, submissions: !prev.submissions }))}
              className="w-full px-5 py-4 flex items-center justify-between text-left"
            >
              <div>
                <div className={ui.label}>Inlämningsanalys (klickbar rubrik)</div>
                <div className="text-sm text-[#6B6158]">Startformulär + uppföljning, idag och i valt intervall.</div>
              </div>
              <ChevronDown className={`w-5 h-5 text-[#8A8177] transition-transform ${sectionOpen.submissions ? 'rotate-180' : ''}`} />
            </button>
            {sectionOpen.submissions && (
              <div className="border-t border-[#EFE7DC] p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                    <div className={ui.label}>Idag</div>
                    <div className="mt-2 text-xl font-black text-[#3D3D3D]">{startSubmissions.length + uppSubmissions.length}</div>
                  </div>
                  <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                    <div className={ui.label}>Intervall ({analysisWindowDays}d)</div>
                    <div className="mt-2 text-xl font-black text-[#3D3D3D]">{submissionsInRangeTotal}</div>
                  </div>
                  <div className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                    <div className={ui.label}>Override-beslut ({analysisWindowDays}d)</div>
                    <div className="mt-2 text-xl font-black text-[#3D3D3D]">{analytics.totals.manager_overrides}</div>
                  </div>
                </div>
                <div className="space-y-3 text-sm text-[#6B6158]">
                  {submissionsInRangeTotal === 0 && <div>Inga formulär i valt intervall.</div>}
                  {startSubmissionsInWindow.slice(0, 5).map((item) => (
                    <div key={`start-${item.id}`} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                      <div className="text-sm font-bold text-[#3D3D3D]">Startformulär</div>
                      <div className="text-[11px] text-[#8A8177]">{item.first_name} {item.last_name} · {formatDateTime(item.created_at)}</div>
                    </div>
                  ))}
                  {uppSubmissionsInWindow.slice(0, 5).map((item) => (
                    <div key={`upp-${item.id}`} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                      <div className="text-sm font-bold text-[#3D3D3D]">Uppföljning</div>
                      <div className="text-[11px] text-[#8A8177]">{item.first_name} {item.last_name} · {formatDateTime(item.created_at)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
