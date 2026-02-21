import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ClipboardList, FileText, LayoutDashboard, Loader2, RefreshCcw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type BaseSubmission = {
  id: string;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  is_done?: boolean | null;
  done_at?: string | null;
  done_by?: string | null;
};

type StartFormEntry = BaseSubmission & {
  desired_start_date: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  focus_areas: string[] | null;
  goal_description: string | null;
  injuries: string | null;
  training_experience: string | null;
  activity_last_6_months: string | null;
  diet_last_6_months: string | null;
  training_forms: string[] | null;
  training_forms_other: string | null;
  training_places: string[] | null;
  training_places_other: string | null;
  sessions_per_week: string | null;
  sessions_per_week_other: string | null;
  measurement_chest_back: number | null;
  measurement_arm_right: number | null;
  measurement_arm_left: number | null;
  measurement_shoulders: number | null;
  measurement_waist: number | null;
  measurement_thigh_right: number | null;
  measurement_thigh_left: number | null;
  measurement_calf_right: number | null;
  measurement_calf_left: number | null;
};

type UppfoljningEntry = BaseSubmission & {
  quick_keep_plan: boolean | null;
  summary_feedback: string | null;
  goal: string | null;
  other_activity: string[] | null;
  training_places: string[] | null;
  training_places_other: string | null;
  home_equipment: string[] | null;
  home_equipment_other: string | null;
  sessions_per_week: number | null;
  refill_products: string[] | null;
  auto_continue: string | null;
};

type CombinedSubmission =
  | { kind: 'start'; data: StartFormEntry }
  | { kind: 'uppfoljning'; data: UppfoljningEntry };

type AgendaTemplate = {
  id: string;
  title: string;
  schedule_days: string[] | null;
  interval_weeks: number | null;
  input_type: string | null;
  sort_order: number | null;
  is_active?: boolean | null;
};

type AgendaItem = {
  id: string;
  title: string;
  inputType: 'none' | 'count' | 'text';
  sortOrder: number;
  count?: string | number | null;
};

type FilterValue = 'uppfoljning' | 'start' | 'done';
type StaffTab = 'OVERVIEW' | 'BASE' | 'REPORT' | 'AGENDA';

const REPORT_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1514319/ucizdpt/';
const REPORT_OVERTIME_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1514319/ucicwgs/';

type InfoRowProps = {
  label: string;
  value: React.ReactNode;
};

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'Okänt datum';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('sv-SE', { dateStyle: 'medium' });
};

const formatList = (items?: string[] | null) => {
  if (!items || items.length === 0) return '—';
  return items.join(', ');
};

const formatBoolean = (value?: boolean | null) => {
  if (value === true) return 'Ja';
  if (value === false) return 'Nej';
  return '—';
};

const formatNumber = (value?: number | null, suffix = '') => {
  if (value === null || value === undefined) return '—';
  return `${value}${suffix}`;
};

const truncate = (value?: string | null, maxLength = 160) => {
  if (!value) return '—';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}…`;
};

const getNextWorkday = (date: Date) => {
  const next = new Date(date);
  do {
    next.setDate(next.getDate() + 1);
  } while (next.getDay() === 0 || next.getDay() === 6);
  return next;
};

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10);
const formatTimeInput = (date: Date) => date.toTimeString().slice(0, 5);

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;

const getWeekdayCode = (date: Date) => WEEKDAY_CODES[date.getDay()];

const getWeekStart = (date: Date) => {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const start = new Date(date);
  start.setDate(date.getDate() + diff);
  return start;
};

const getWorkweekDates = (date: Date) => {
  const start = getWeekStart(date);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">{label}</span>
    <span className="text-sm text-[#3D3D3D]">{value}</span>
  </div>
);

const buildMeasurements = (entry: StartFormEntry) => {
  const pairs: Array<[string, number | null | undefined]> = [
    ['Bröst/rygg', entry.measurement_chest_back],
    ['Arm höger', entry.measurement_arm_right],
    ['Arm vänster', entry.measurement_arm_left],
    ['Axlar', entry.measurement_shoulders],
    ['Midja', entry.measurement_waist],
    ['Lår höger', entry.measurement_thigh_right],
    ['Lår vänster', entry.measurement_thigh_left],
    ['Vad höger', entry.measurement_calf_right],
    ['Vad vänster', entry.measurement_calf_left]
  ];

  const formatted = pairs
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([label, value]) => `${label}: ${value} cm`);

  return formatted.length ? formatted.join(' · ') : '—';
};

const Intranet: React.FC = () => {
  const { session, profile } = useAuthStore();
  const isStaff = profile?.is_staff === true;
  const [filter, setFilter] = useState<FilterValue>('uppfoljning');
  const [activeTab, setActiveTab] = useState<StaffTab>('OVERVIEW');
  const [startEntries, setStartEntries] = useState<StartFormEntry[]>([]);
  const [uppfoljningar, setUppfoljningar] = useState<UppfoljningEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState({
    date: formatDateInput(new Date()),
    startTime: '',
    endTime: '',
    did: '',
    handover: '',
    messagesCount: '',
    startsCount: '',
    followupsCount: '',
    overtime: false
  });
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [reportError, setReportError] = useState<string | null>(null);
  const [planningStartedAt, setPlanningStartedAt] = useState<string | null>(null);
  const [planningEndedAt, setPlanningEndedAt] = useState<string | null>(null);
  const [shiftStartedAt, setShiftStartedAt] = useState<string | null>(null);
  const [showWeek, setShowWeek] = useState(false);
  const [weeklyReports, setWeeklyReports] = useState<Record<string, any>>({});
  const isConfigured = isSupabaseConfigured();
  const [expandedWeekDays, setExpandedWeekDays] = useState<Record<string, boolean>>({});
  const [agendaCompletionByDate, setAgendaCompletionByDate] = useState<Record<string, string[]>>({});
  const selectedDate = useMemo(() => {
    if (!reportForm.date) return new Date();
    return new Date(`${reportForm.date}T00:00:00`);
  }, [reportForm.date]);

  const nextWorkday = useMemo(() => getNextWorkday(selectedDate), [selectedDate]);
  const [agendaTemplates, setAgendaTemplates] = useState<AgendaTemplate[]>([]);
  const [agendaStatus, setAgendaStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [agendaError, setAgendaError] = useState<string | null>(null);

  const [handoverHistory, setHandoverHistory] = useState<Array<{ text: string; created_at: string }>>([]);
  const [dataStats, setDataStats] = useState<{ completedTasks: number; reportCount: number; handoverCount: number }>({
    completedTasks: 0,
    reportCount: 0,
    handoverCount: 0
  });
  const [dataStatsError, setDataStatsError] = useState<string | null>(null);
  const [expandedHandovers, setExpandedHandovers] = useState<Record<string, boolean>>({});

  const refreshDataOverview = useCallback(async () => {
    if (!session?.user?.id || !isStaff || !isConfigured) return;
    try {
      setDataStatsError(null);
      const [{ count: reportCount, error: reportError }, handoversRes, completionsRes] = await Promise.all([
        supabase
          .from('staff_reports')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id),
        supabase
          .from('staff_handovers')
          .select('handover, created_at')
          .eq('created_by', session.user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('agenda_completions')
          .select('completed_task_ids')
          .eq('user_id', session.user.id)
      ]);

      if (reportError) throw reportError;
      if (handoversRes.error) throw handoversRes.error;
      if (completionsRes.error) throw completionsRes.error;

      const handovers = (handoversRes.data || []).map((item: any) => ({
        text: item.handover,
        created_at: item.created_at
      }));
      const completedTasks = (completionsRes.data || []).reduce((sum: number, row: any) => (
        sum + (row.completed_task_ids?.length || 0)
      ), 0);

      setHandoverHistory(handovers);
      setDataStats({
        completedTasks,
        reportCount: reportCount || 0,
        handoverCount: handovers.length
      });
    } catch (err) {
      console.warn('Failed to load data overview', err);
      const fallbackCompleted = Object.values(agendaCompletionByDate).reduce((sum, ids) => sum + ids.length, 0);
      const fallbackReports = Object.keys(weeklyReports || {}).length;
      const fallbackHandovers = handoverHistory.length;
      setDataStatsError('Kunde inte läsa data från Supabase. Visar lokal data.');
      setDataStats({
        completedTasks: fallbackCompleted,
        reportCount: fallbackReports,
        handoverCount: fallbackHandovers
      });
    }
  }, [agendaCompletionByDate, handoverHistory.length, isConfigured, isStaff, session?.user?.id, weeklyReports]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active) return;
      await refreshDataOverview();
    };
    load();
    return () => {
      active = false;
    };
  }, [refreshDataOverview]);

  useEffect(() => {
    if (!session?.user?.id || !isStaff) return;
    let active = true;
    const loadReports = async () => {
      try {
        const days = getWorkweekDates(selectedDate);
        const startKey = formatDateInput(days[0]);
        const endKey = formatDateInput(days[4]);
        const { data, error } = await supabase
          .from('staff_reports')
          .select('*')
          .gte('report_date', startKey)
          .lte('report_date', endKey)
          .order('report_date', { ascending: true });
        if (error) throw error;
        if (!active) return;
        const reportMap: Record<string, any> = {};
        (data || []).forEach((row: any) => {
          reportMap[row.report_date] = row;
        });
        setWeeklyReports(reportMap);
      } catch (err) {
        console.warn('Failed to load weekly reports', err);
        if (!active) return;
        setWeeklyReports({});
      }
    };
    loadReports();
    return () => {
      active = false;
    };
  }, [selectedDate, session?.user?.id, isStaff]);

  useEffect(() => {
    if (!session?.user?.id || !isStaff || !isConfigured) return;
    let active = true;
    const loadTemplates = async () => {
      setAgendaStatus('loading');
      setAgendaError(null);
      try {
        const { data, error } = await supabase
          .from('agenda_templates')
          .select('id,title,schedule_days,interval_weeks,input_type,sort_order,is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        if (!active) return;
        setAgendaTemplates(data || []);
        setAgendaStatus('idle');
      } catch (err) {
        if (!active) return;
        setAgendaStatus('error');
        setAgendaError('Kunde inte hämta basuppgifter.');
      }
    };
    loadTemplates();
    return () => {
      active = false;
    };
  }, [session?.user?.id, isStaff, isConfigured]);

  useEffect(() => {
    if (!session?.user?.id || !isStaff) return;
    const dateKey = formatDateInput(selectedDate);
    let active = true;
    const loadCompletion = async () => {
      try {
        if (isConfigured) {
          const { data, error } = await supabase
            .from('agenda_completions')
            .select('report_date, completed_task_ids')
            .eq('user_id', session.user.id)
            .eq('report_date', dateKey)
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          if (!active) return;
          const ids = data?.completed_task_ids || [];
          setAgendaCompletionByDate((prev) => ({ ...prev, [dateKey]: ids }));
          return;
        }
      } catch (err) {
        console.warn('Failed to load agenda completion', err);
      }

      if (!active) return;
      try {
        const stored = JSON.parse(localStorage.getItem(`staff-agenda-completed-${dateKey}`) || '[]');
        setAgendaCompletionByDate((prev) => ({ ...prev, [dateKey]: stored }));
      } catch (err) {
        setAgendaCompletionByDate((prev) => ({ ...prev, [dateKey]: [] }));
      }
    };
    loadCompletion();
    return () => {
      active = false;
    };
  }, [selectedDate, session?.user?.id, isStaff, isConfigured]);

  const resolveTaskCount = useCallback((
    title: string,
    report: any,
    useFormFallback: boolean
  ) => {
    const normalize = (value: any) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string' && value.trim() === '') return null;
      return value;
    };
    if (title === 'Meddelanden') {
      return normalize(report?.messages_count ?? (useFormFallback ? reportForm.messagesCount : null));
    }
    if (title === 'Startupplägg') {
      return normalize(report?.starts_count ?? (useFormFallback ? reportForm.startsCount : null));
    }
    if (title === 'Uppföljningsupplägg') {
      return normalize(report?.followups_count ?? (useFormFallback ? reportForm.followupsCount : null));
    }
    return null;
  }, [reportForm.followupsCount, reportForm.messagesCount, reportForm.startsCount]);

  const getTasksForDate = useCallback((date: Date): AgendaItem[] => {
    if (!agendaTemplates.length) return [];
    const dayCode = getWeekdayCode(date);
    const key = formatDateInput(date);
    const report = weeklyReports[key];
    const useFormFallback = key === reportForm.date;
    return agendaTemplates
      .filter((template) => (template.schedule_days || []).includes(dayCode))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((template) => {
        const inputType = (template.input_type as AgendaItem['inputType']) || 'none';
        const count = inputType === 'count'
          ? resolveTaskCount(template.title, report, useFormFallback)
          : null;
        return {
          id: template.id,
          title: template.title,
          inputType,
          sortOrder: template.sort_order ?? 0,
          count
        };
      });
  }, [agendaTemplates, reportForm.date, resolveTaskCount, weeklyReports]);

  const todayTasks = useMemo(() => getTasksForDate(selectedDate), [getTasksForDate, selectedDate]);
  const completedTaskIdsForDay = useMemo(() => {
    const key = formatDateInput(selectedDate);
    return new Set(agendaCompletionByDate[key] || []);
  }, [agendaCompletionByDate, selectedDate]);
  const completedTasks = useMemo(() => (
    todayTasks.filter((task) => completedTaskIdsForDay.has(task.id))
  ), [completedTaskIdsForDay, todayTasks]);
  const incompleteTasks = useMemo(() => (
    todayTasks.filter((task) => !completedTaskIdsForDay.has(task.id))
  ), [completedTaskIdsForDay, todayTasks]);

  const toggleAgendaTask = useCallback(async (taskId: string) => {
    const dateKey = formatDateInput(selectedDate);
    const current = new Set(agendaCompletionByDate[dateKey] || []);
    const wasChecked = current.has(taskId);
    if (current.has(taskId)) current.delete(taskId);
    else current.add(taskId);
    const updated = Array.from(current);
    setAgendaCompletionByDate((prev) => ({ ...prev, [dateKey]: updated }));
    try {
      localStorage.setItem(`staff-agenda-completed-${dateKey}`, JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to persist agenda completion locally', err);
    }
    if (!isConfigured || !session?.user?.id) return;
    try {
      const { error } = await supabase
        .from('agenda_completions')
        .upsert({
          user_id: session.user.id,
          report_date: dateKey,
          completed_task_ids: updated,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,report_date' });
      if (error) throw error;
      setDataStats((prev) => ({
        ...prev,
        completedTasks: Math.max(0, prev.completedTasks + (wasChecked ? -1 : 1))
      }));
      await refreshDataOverview();
    } catch (err) {
      console.warn('Failed to persist agenda completion', err);
    }
  }, [agendaCompletionByDate, isConfigured, refreshDataOverview, selectedDate, session?.user?.id]);

  const loadSubmissions = useCallback(async () => {
    if (!isConfigured) return;
    setIsLoading(true);
    setErrorMessage(null);

    const errors: string[] = [];

    const [startResult, uppResult] = await Promise.all([
      supabase
        .from('startformular')
        .select(`
          id,
          created_at,
          first_name,
          last_name,
          email,
          is_done,
          done_at,
          done_by,
          desired_start_date,
          weight_kg,
          height_cm,
          age,
          focus_areas,
          goal_description,
          injuries,
          training_experience,
          activity_last_6_months,
          diet_last_6_months,
          training_forms,
          training_forms_other,
          training_places,
          training_places_other,
          sessions_per_week,
          sessions_per_week_other,
          measurement_chest_back,
          measurement_arm_right,
          measurement_arm_left,
          measurement_shoulders,
          measurement_waist,
          measurement_thigh_right,
          measurement_thigh_left,
          measurement_calf_right,
          measurement_calf_left
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('uppfoljningar')
        .select(`
          id,
          created_at,
          first_name,
          last_name,
          email,
          is_done,
          done_at,
          done_by,
          quick_keep_plan,
          summary_feedback,
          goal,
          other_activity,
          training_places,
          training_places_other,
          home_equipment,
          home_equipment_other,
          sessions_per_week,
          refill_products,
          auto_continue
        `)
        .order('created_at', { ascending: false })
    ]);

    if (startResult.error) {
      errors.push(`Startformulär: ${startResult.error.message}`);
    } else {
      setStartEntries(startResult.data || []);
    }

    if (uppResult.error) {
      errors.push(`Uppföljningar: ${uppResult.error.message}`);
    } else {
      setUppfoljningar(uppResult.data || []);
    }

    if (errors.length) {
      setErrorMessage(errors.join(' '));
    }

    setLastUpdated(new Date().toISOString());
    setIsLoading(false);
  }, [isConfigured]);

  useEffect(() => {
    if (!session?.user?.id || !isStaff) return;
    loadSubmissions();
  }, [session?.user?.id, isStaff, loadSubmissions]);

  const combined = useMemo<CombinedSubmission[]>(() => {
    const startItems: CombinedSubmission[] = startEntries.map((entry) => ({
      kind: 'start',
      data: entry
    }));

    const uppItems: CombinedSubmission[] = uppfoljningar.map((entry) => ({
      kind: 'uppfoljning',
      data: entry
    }));

    return [...startItems, ...uppItems].sort((a, b) => {
      const aTime = new Date(a.data.created_at).getTime();
      const bTime = new Date(b.data.created_at).getTime();
      return bTime - aTime;
    });
  }, [startEntries, uppfoljningar]);

  const counts = useMemo(() => {
    const startOpen = startEntries.filter((item) => !item.is_done).length;
    const uppOpen = uppfoljningar.filter((item) => !item.is_done).length;
    const done = combined.filter((item) => item.data.is_done).length;
    return { startOpen, uppOpen, done };
  }, [startEntries, uppfoljningar, combined]);

  const filtered = useMemo(() => {
    if (filter === 'done') {
      return combined
        .filter((item) => item.data.is_done)
        .sort((a, b) => {
          const aTime = new Date(a.data.done_at || a.data.created_at).getTime();
          const bTime = new Date(b.data.done_at || b.data.created_at).getTime();
          return bTime - aTime;
        });
    }

    return combined.filter((item) => item.kind === filter && !item.data.is_done);
  }, [combined, filter]);

  const toggleExpanded = (key: string) => {
    setExpandedId((current) => (current === key ? null : key));
  };

  const updateCompletion = async (submission: CombinedSubmission, nextDone: boolean) => {
    if (!session?.user?.id) return;
    setUpdatingId(`${submission.kind}-${submission.data.id}`);

    const payload = {
      is_done: nextDone,
      done_at: nextDone ? new Date().toISOString() : null,
      done_by: nextDone ? session.user.id : null
    };

    const table = submission.kind === 'start' ? 'startformular' : 'uppfoljningar';
    const { error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', submission.data.id);

    if (error) {
      setErrorMessage(error.message);
      setUpdatingId(null);
      return;
    }

    if (submission.kind === 'start') {
      setStartEntries((prev) => prev.map((item) => (
        item.id === submission.data.id ? { ...item, ...payload } : item
      )));
    } else {
      setUppfoljningar((prev) => prev.map((item) => (
        item.id === submission.data.id ? { ...item, ...payload } : item
      )));
    }

    setUpdatingId(null);
  };

  const handleStartPlanning = () => {
    if (planningStartedAt) return;
    setPlanningStartedAt(new Date().toISOString());
  };

  const handleStopPlanning = () => {
    if (!planningStartedAt || planningEndedAt) return;
    setPlanningEndedAt(new Date().toISOString());
  };

  const handleStartShift = () => {
    if (shiftStartedAt) return;
    const now = new Date();
    setShiftStartedAt(now.toISOString());
    setReportForm((prev) => ({ ...prev, startTime: formatTimeInput(now) }));
  };

  const handleReportSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setReportError(null);
    setReportStatus('idle');

    if (!reportForm.startTime || !reportForm.endTime) {
      setReportError('Ange start- och sluttid.');
      setReportStatus('error');
      return;
    }
    if (reportForm.did.trim().length < 20) {
      setReportError('Skriv lite mer om vad du gjort (minst 20 tecken).');
      setReportStatus('error');
      return;
    }
    const handoverText = reportForm.handover.trim();
    const handoverRequired = incompleteTasks.length > 0;
    if (handoverRequired && handoverText.length < 20) {
      setReportError('Alla uppgifter är inte klara. Skriv en tydlig prioritering inför imorgon (minst 20 tecken).');
      setReportStatus('error');
      return;
    }
    if (!handoverRequired && handoverText.length > 0 && handoverText.length < 20) {
      setReportError('Om du skriver en prioritering, skriv minst 20 tecken.');
      setReportStatus('error');
      return;
    }
    const completedTitles = completedTasks.map((task) => task.title);
    const incompleteTitles = incompleteTasks.map((task) => task.title);
    const completedIds = completedTasks.map((task) => task.id);
    const incompleteIds = incompleteTasks.map((task) => task.id);
    const payload = {
      user_id: session?.user?.id || '',
      email: profile?.email || session?.user?.email || '',
      name: profile?.full_name || '',
      date: reportForm.date,
      start_time: reportForm.startTime,
      end_time: reportForm.endTime,
      did: reportForm.did.trim(),
      handover: handoverText,
      completed_tasks: completedTitles.join(', '),
      incomplete_tasks: incompleteTitles.join(', '),
      completed_task_ids: JSON.stringify(completedIds),
      incomplete_task_ids: JSON.stringify(incompleteIds),
      messages_count: reportForm.messagesCount,
      starts_count: reportForm.startsCount,
      followups_count: reportForm.followupsCount,
      planning_started_at: planningStartedAt,
      planning_ended_at: planningEndedAt,
      shift_started_at: shiftStartedAt,
      overtime: reportForm.overtime,
      source: 'staff_report',
      submitted_at: new Date().toISOString()
    };

    const body = new URLSearchParams(
      Object.entries(payload).map(([key, value]) => [key, String(value ?? '')])
    ).toString();

    const webhookUrl = reportForm.overtime ? REPORT_OVERTIME_WEBHOOK_URL : REPORT_WEBHOOK_URL;

    if (!webhookUrl) {
      setReportError(reportForm.overtime
        ? 'Webhook saknas för övertid. Lägg in Zapier-URL för övertid.'
        : 'Webhook saknas för ordinarie arbetstid. Lägg in Zapier-URL.');
      setReportStatus('error');
      return;
    }

    setReportStatus('sending');

    try {
      let res: Response | null = null;
      try {
        res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
      } catch (err) {
        console.warn('Report webhook primary failed, retrying no-cors:', err);
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body
        });
        res = null;
      }

      if (res && !res.ok) throw new Error('Webhook failed');

      setReportStatus('success');
      try {
        const reportKey = `staff-report-${reportForm.date}`;
        const snapshot = {
          date: reportForm.date,
          start_time: reportForm.startTime,
          end_time: reportForm.endTime,
          did: reportForm.did.trim(),
          handover: handoverText,
          completed_tasks: completedTitles,
          incomplete_tasks: incompleteTitles,
          completed_task_ids: completedIds,
          incomplete_task_ids: incompleteIds,
          messages_count: reportForm.messagesCount,
          starts_count: reportForm.startsCount,
          followups_count: reportForm.followupsCount,
          overtime: reportForm.overtime,
          planning_started_at: planningStartedAt,
          planning_ended_at: planningEndedAt,
          shift_started_at: shiftStartedAt
        };
        localStorage.setItem(reportKey, JSON.stringify(snapshot));
        setWeeklyReports((prev) => ({ ...prev, [reportForm.date]: snapshot }));
      } catch (err) {
        console.warn('Failed to store report locally', err);
      }

      try {
        const reportPayload = {
          user_id: session?.user?.id,
          report_date: reportForm.date,
          start_time: reportForm.startTime,
          end_time: reportForm.endTime,
          did: reportForm.did.trim(),
          handover: handoverText,
          completed_tasks: completedTitles,
          incomplete_tasks: incompleteTitles,
          completed_task_ids: completedIds,
          incomplete_task_ids: incompleteIds,
          messages_count: reportForm.messagesCount ? Number(reportForm.messagesCount) : null,
          starts_count: reportForm.startsCount ? Number(reportForm.startsCount) : null,
          followups_count: reportForm.followupsCount ? Number(reportForm.followupsCount) : null,
          planning_started_at: planningStartedAt,
          planning_ended_at: planningEndedAt,
          shift_started_at: shiftStartedAt,
          overtime: reportForm.overtime
        };
        const { error } = await supabase.from('staff_reports').insert([reportPayload]);
        if (error) throw error;
      } catch (err) {
        console.warn('Failed to write staff report', err);
      }
      try {
        const baseDate = reportForm.date ? new Date(`${reportForm.date}T00:00:00`) : new Date();
        const nextDate = getNextWorkday(baseDate);
        const handoverPayload = {
          report_date: formatDateInput(nextDate),
          created_by: session?.user?.id,
          handover: handoverText
        };
        const { error } = await supabase.from('staff_handovers').insert([handoverPayload]);
        if (error) throw error;
        setHandoverHistory((prev) => ([
          { text: handoverText, created_at: new Date().toISOString() },
          ...prev
        ]));
        setDataStats((prev) => ({
          ...prev,
          handoverCount: prev.handoverCount + 1
        }));
        await refreshDataOverview();
      } catch (err) {
        console.warn('Failed to write staff handover', err);
      }
      setReportForm((prev) => ({
        ...prev,
        startTime: '',
        endTime: '',
        did: '',
        handover: '',
        messagesCount: '',
        startsCount: '',
        followupsCount: '',
        overtime: false
      }));
      setPlanningStartedAt(null);
      setPlanningEndedAt(null);
      setShiftStartedAt(null);
    } catch (err) {
      console.error('Report webhook error:', err);
      setReportStatus('error');
      setReportError('Kunde inte skicka rapporten. Försök igen.');
    }
  };

  const renderSubmissionCards = (items: CombinedSubmission[], emptyText: string) => {
    if (isLoading && items.length === 0) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-[#a0c81d]" />
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="rounded-3xl border border-[#DAD1C5] bg-white p-8 text-center text-[#6B6158] shadow-[0_12px_30px_rgba(61,61,61,0.12)]">
          {emptyText}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {items.map((submission) => {
          const { data } = submission;
          const fullName = `${data.first_name} ${data.last_name}`.trim();
          const key = `${submission.kind}-${data.id}`;
          const isExpanded = expandedId === key;
          const badgeStyle = submission.kind === 'start'
            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
            : 'bg-cyan-500/10 text-cyan-700 border-cyan-500/30';
          const statusStyle = data.is_done
            ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
            : 'bg-amber-500/10 text-amber-700 border-amber-500/30';

          return (
            <div key={key} className="bg-white rounded-2xl border border-[#DAD1C5] shadow-[0_16px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5">
              <button
                type="button"
                onClick={() => toggleExpanded(key)}
                className="w-full text-left px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] border rounded-full px-3 py-1 ${badgeStyle}`}>
                      {submission.kind === 'start' ? 'Startformulär' : 'Uppföljning'}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-[0.3em] border rounded-full px-3 py-1 ${statusStyle}`}>
                      {data.is_done ? 'Genomförd' : 'Pågående'}
                    </span>
                    <span className="text-xs text-[#8A8177]">{formatTimestamp(data.created_at)}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#3D3D3D]">{fullName || 'Okänt namn'}</h3>
                    <p className="text-sm text-[#6B6158]">{data.email || 'Ingen e-post'}</p>
                  </div>
                  <p className="text-sm text-[#6B6158]">
                    {submission.kind === 'start'
                      ? `Fokus: ${truncate(formatList(submission.data.focus_areas), 120)}`
                      : truncate(submission.data.summary_feedback, 140)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ChevronDown className={`w-5 h-5 text-[#8A8177] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 border-t border-[#DAD1C5]">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-4">
                    <div className="text-xs text-[#8A8177]">
                      {data.is_done
                        ? `Klarmarkerad: ${formatTimestamp(data.done_at)}`
                        : 'Ej klarmarkerad'}
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        updateCompletion(submission, !data.is_done);
                      }}
                      className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition flex items-center gap-2 ${
                        data.is_done
                          ? 'bg-white border-[#DAD1C5] text-[#3D3D3D] hover:border-emerald-400/40'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 hover:border-emerald-400/60'
                      }`}
                      disabled={updatingId === key}
                    >
                      {updatingId === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {data.is_done ? 'Återställ' : 'Klarmarkera'}
                    </button>
                  </div>

                  {submission.kind === 'start' ? (
                    <div className="mt-6 space-y-6">
                      <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Nyckelinfo</h4>
                        <div className="space-y-3">
                          <InfoRow label="Önskat startdatum" value={formatDateOnly(submission.data.desired_start_date)} />
                          <InfoRow label="Pass per vecka" value={submission.data.sessions_per_week || '—'} />
                          <InfoRow label="Fokusområden" value={formatList(submission.data.focus_areas)} />
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Grunddata</h4>
                        <div className="space-y-3">
                          <InfoRow label="Vikt" value={formatNumber(submission.data.weight_kg, ' kg')} />
                          <InfoRow label="Längd" value={formatNumber(submission.data.height_cm, ' cm')} />
                          <InfoRow label="Ålder" value={formatNumber(submission.data.age)} />
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Mål & bakgrund</h4>
                        <div className="space-y-3">
                          <InfoRow label="Målbeskrivning" value={submission.data.goal_description || '—'} />
                          <InfoRow label="Skador" value={submission.data.injuries || '—'} />
                          <InfoRow label="Träningserfarenhet" value={submission.data.training_experience || '—'} />
                          <InfoRow label="Aktivitet 6 månader" value={submission.data.activity_last_6_months || '—'} />
                          <InfoRow label="Kosthållning 6 månader" value={submission.data.diet_last_6_months || '—'} />
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Träningsupplägg</h4>
                        <div className="space-y-3">
                          <InfoRow label="Träningsformer" value={formatList(submission.data.training_forms)} />
                          <InfoRow label="Träningsformer annat" value={submission.data.training_forms_other || '—'} />
                          <InfoRow label="Träningsplatser" value={formatList(submission.data.training_places)} />
                          <InfoRow label="Träningsplatser annat" value={submission.data.training_places_other || '—'} />
                          <InfoRow label="Pass/vecka (detalj)" value={submission.data.sessions_per_week_other || '—'} />
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Kroppsmått</h4>
                        <div className="space-y-3">
                          <InfoRow label="Mått (cm)" value={buildMeasurements(submission.data)} />
                        </div>
                      </section>
                    </div>
                  ) : (
                    <div className="mt-6 space-y-6">
                      <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Översikt</h4>
                        <div className="space-y-3">
                          <InfoRow label="Mål" value={submission.data.goal || '—'} />
                          <InfoRow label="Pass per vecka" value={formatNumber(submission.data.sessions_per_week)} />
                          <InfoRow label="Behåll upplägg" value={formatBoolean(submission.data.quick_keep_plan)} />
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Summering & feedback</h4>
                        <div className="space-y-3">
                          <InfoRow label="Sammanfattning" value={submission.data.summary_feedback || '—'} />
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Träning</h4>
                        <div className="space-y-3">
                          <InfoRow label="Övrig aktivitet" value={formatList(submission.data.other_activity)} />
                          <InfoRow label="Träningsplatser" value={formatList(submission.data.training_places)} />
                          <InfoRow label="Träningsplatser annat" value={submission.data.training_places_other || '—'} />
                          <InfoRow label="Utrustning hemma" value={formatList(submission.data.home_equipment)} />
                          <InfoRow label="Utrustning annat" value={submission.data.home_equipment_other || '—'} />
                        </div>
                      </section>

                      <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Produkter & fortsättning</h4>
                        <div className="space-y-3">
                          <InfoRow label="Påfyllnad" value={formatList(submission.data.refill_products)} />
                          <InfoRow label="Auto fortsätt" value={submission.data.auto_continue || '—'} />
                        </div>
                      </section>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-32 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-3">
            <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-4 border border-[#DAD1C5] shadow-[0_16px_45px_rgba(61,61,61,0.12)] sticky top-28 space-y-2">
              <button
                type="button"
                onClick={() => { setActiveTab('OVERVIEW'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'OVERVIEW'
                    ? 'bg-[#E8F1D5] text-[#3D3D3D] border border-[#a0c81d]/40 shadow-[0_0_20px_rgba(160,200,29,0.12)]'
                    : 'text-[#6B6158] hover:bg-[#E8F1D5]/50 border border-transparent'
                }`}
              >
                <span className={`p-2 rounded-xl ${activeTab === 'OVERVIEW' ? 'bg-[#a0c81d] text-[#F6F1E7]' : 'bg-[#F6F1E7] text-[#8A8177]'}`}>
                  <LayoutDashboard className="w-4 h-4" />
                </span>
                Översikt
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('BASE'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'BASE'
                    ? 'bg-[#E8F1D5] text-[#3D3D3D] border border-[#a0c81d]/40 shadow-[0_0_20px_rgba(160,200,29,0.12)]'
                    : 'text-[#6B6158] hover:bg-[#E8F1D5]/50 border border-transparent'
                }`}
              >
                <span className={`p-2 rounded-xl ${activeTab === 'BASE' ? 'bg-[#a0c81d] text-[#F6F1E7]' : 'bg-[#F6F1E7] text-[#8A8177]'}`}>
                  <FileText className="w-4 h-4" />
                </span>
                Dagsagenda
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('REPORT'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'REPORT'
                    ? 'bg-[#E8F1D5] text-[#3D3D3D] border border-[#a0c81d]/40 shadow-[0_0_20px_rgba(160,200,29,0.12)]'
                    : 'text-[#6B6158] hover:bg-[#E8F1D5]/50 border border-transparent'
                }`}
              >
                <span className={`p-2 rounded-xl ${activeTab === 'REPORT' ? 'bg-[#a0c81d] text-[#F6F1E7]' : 'bg-[#F6F1E7] text-[#8A8177]'}`}>
                  <ClipboardList className="w-4 h-4" />
                </span>
                Rapportering
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('AGENDA'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'AGENDA'
                    ? 'bg-[#E8F1D5] text-[#3D3D3D] border border-[#a0c81d]/40 shadow-[0_0_20px_rgba(160,200,29,0.12)]'
                    : 'text-[#6B6158] hover:bg-[#E8F1D5]/50 border border-transparent'
                }`}
              >
                <span className={`p-2 rounded-xl ${activeTab === 'AGENDA' ? 'bg-[#a0c81d] text-[#F6F1E7]' : 'bg-[#F6F1E7] text-[#8A8177]'}`}>
                  <ClipboardList className="w-4 h-4" />
                </span>
                Data
              </button>
            </div>
          </div>

          <div className="lg:col-span-9">
            {activeTab === 'OVERVIEW' && (
              <div className="space-y-8 animate-fade-in">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-2">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                <ClipboardList className="w-6 h-6" />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Intranät</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D] tracking-tight">Samlad översikt över inlämningar</h1>
            <p className="text-[#6B6158] mt-3 max-w-2xl">Öppna en rad för att se hela inlämningen. Klarmarkera när uppföljningen är hanterad.</p>
          </div>
          <button
            type="button"
            onClick={loadSubmissions}
            className="px-5 py-3 rounded-xl bg-white border border-[#DAD1C5] text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:border-[#a0c81d]/40 hover:text-[#5C7A12] transition flex items-center gap-2 shadow-[0_10px_26px_rgba(61,61,61,0.12)]"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Uppdatera
          </button>
        </div>

        {!isConfigured && (
          <div className="mb-8 rounded-2xl border border-amber-400/40 bg-amber-100/70 p-4 text-amber-800 text-sm">
            Supabase är inte konfigurerat ännu. Lägg in dina nycklar i <code className="text-amber-900">.env.local</code> för att kunna hämta inlämningar.
          </div>
        )}

        {errorMessage && (
          <div className="mb-8 rounded-2xl border border-rose-400/40 bg-rose-100/70 p-4 text-rose-800 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            type="button"
            onClick={() => setFilter('uppfoljning')}
            className={`rounded-2xl border p-5 text-left transition ${
              filter === 'uppfoljning'
                ? 'border-[#a0c81d]/60 bg-[#E8F1D5] shadow-[0_0_18px_rgba(160,200,29,0.12)]'
                : 'border-[#DAD1C5] bg-white hover:border-[#a0c81d]/40'
            }`}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Uppföljningar</div>
            <div className="mt-2 text-2xl font-black text-[#3D3D3D]">{counts.uppOpen}</div>
            <div className="text-xs text-[#6B6158] mt-1">Ohanterade</div>
          </button>
          <button
            type="button"
            onClick={() => setFilter('start')}
            className={`rounded-2xl border p-5 text-left transition ${
              filter === 'start'
                ? 'border-[#a0c81d]/60 bg-[#E8F1D5] shadow-[0_0_18px_rgba(160,200,29,0.12)]'
                : 'border-[#DAD1C5] bg-white hover:border-[#a0c81d]/40'
            }`}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Nya starter</div>
            <div className="mt-2 text-2xl font-black text-[#3D3D3D]">{counts.startOpen}</div>
            <div className="text-xs text-[#6B6158] mt-1">Ohanterade</div>
          </button>
          <button
            type="button"
            onClick={() => setFilter('done')}
            className={`rounded-2xl border p-5 text-left transition ${
              filter === 'done'
                ? 'border-[#a0c81d]/60 bg-[#E8F1D5] shadow-[0_0_18px_rgba(160,200,29,0.12)]'
                : 'border-[#DAD1C5] bg-white hover:border-[#a0c81d]/40'
            }`}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Genomförda</div>
            <div className="mt-2 text-2xl font-black text-[#3D3D3D]">{counts.done}</div>
            <div className="text-xs text-[#6B6158] mt-1">Klarmarkerade</div>
          </button>
        </div>

        {lastUpdated && (
          <div className="text-xs text-[#8A8177] mb-6">
            Senast uppdaterad: {formatTimestamp(lastUpdated)}
          </div>
        )}

        {renderSubmissionCards(
          filtered,
          filter === 'done' ? 'Inga genomförda inlämningar ännu.' : 'Inga inlämningar matchar filtret.'
        )}
      </div>
            )}

            {activeTab === 'BASE' && (
              <div className="space-y-8 animate-fade-in">
                <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_20px_60px_rgba(61,61,61,0.18)] ring-1 ring-black/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Dagsagenda</p>
                      <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D] tracking-tight">
                        {selectedDate.toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </h1>
                    </div>
                  </div>
                  <p className="text-[#6B6158] text-sm max-w-2xl">
                    Här finns dagens basuppgifter som måste göras. Utöver detta kan du lägga tid på förbättringar och utveckling när volymen tillåter.
                  </p>
                </div>

                <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_18px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Dagens uppgifter</p>
                        <h2 className="text-xl font-black text-[#3D3D3D]">Återkommande punkter</h2>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowWeek((prev) => !prev)}
                      className="px-4 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition-all"
                    >
                      {showWeek ? 'Dölj veckan' : 'Se hela veckan'}
                    </button>
                  </div>
                  {todayTasks.length === 0 ? (
                    <div className="text-sm text-[#8A8177]">
                      {agendaStatus === 'loading'
                        ? 'Hämtar basuppgifter...'
                        : agendaStatus === 'error'
                          ? agendaError
                          : 'Ingen agenda definierad för idag.'}
                    </div>
                  ) : (
                    <ul className="space-y-2 text-sm text-[#6B6158]">
                      {todayTasks.map((task) => {
                        const showCount = task.count !== null && task.count !== undefined && `${task.count}` !== '';
                        const isChecked = completedTaskIdsForDay.has(task.id);
                        return (
                          <li key={task.id}>
                            <label className="flex items-start gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleAgendaTask(task.id)}
                                className="mt-1 accent-[#a0c81d]"
                              />
                              <span className="flex flex-wrap items-baseline gap-2">
                                <span className={isChecked ? 'line-through text-[#8A8177]' : undefined}>
                                  {task.title}
                                </span>
                                {showCount && (
                                  <span className="text-[11px] font-black uppercase tracking-widest text-[#8A8177]">
                                    {task.count}
                                  </span>
                                )}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {showWeek && (
                  <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_18px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Veckovy</p>
                        <h2 className="text-xl font-black text-[#3D3D3D]">Denna vecka</h2>
                      </div>
                      <div className="text-xs text-[#8A8177]">
                        {formatDateInput(getWeekStart(selectedDate))} – {formatDateInput(getWorkweekDates(selectedDate)[4])}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {getWorkweekDates(selectedDate).map((day) => {
                        const key = formatDateInput(day);
                        const tasks = getTasksForDate(day);
                        const isExpanded = !!expandedWeekDays[key];
                        const visibleTasks = isExpanded ? tasks : tasks.slice(0, 4);
                        const remainingCount = tasks.length - visibleTasks.length;
                        const report = weeklyReports[key];
                        return (
                          <div key={key} className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                              {day.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </div>
                            <div className="text-sm font-black text-[#3D3D3D] mt-1">
                              {report ? 'Rapporterad' : 'Ej rapporterad'}
                            </div>
                            <div className="mt-2 text-[11px] text-[#6B6158] space-y-1">
                              <div>Meddelanden: {report?.messages_count || '—'}</div>
                              <div>Startupplägg: {report?.starts_count || '—'}</div>
                              <div>Uppföljningar: {report?.followups_count || '—'}</div>
                            </div>
                            <div className="mt-3 text-[11px] text-[#6B6158]">
                              {tasks.length === 0
                                ? 'Ingen agenda.'
                                : visibleTasks.map((task) => {
                                    const showCount = task.count !== null && task.count !== undefined && `${task.count}` !== '';
                                    return showCount ? `${task.title} ${task.count}` : task.title;
                                  }).join(' · ')}
                            </div>
                            {tasks.length > 4 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedWeekDays((prev) => ({
                                    ...prev,
                                    [key]: !prev[key]
                                  }))
                                }
                                className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177] hover:text-[#3D3D3D] transition"
                              >
                                {isExpanded ? 'Visa färre' : `+ ${remainingCount} till`}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}

            {activeTab === 'REPORT' && (
              <div className="space-y-8 animate-fade-in">
                <form
                  onSubmit={handleReportSubmit}
                  className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_20px_60px_rgba(61,61,61,0.18)] ring-1 ring-black/5 space-y-6"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Rapportering</p>
                        <h2 className="text-2xl md:text-3xl font-black text-[#3D3D3D] tracking-tight">
                          Uppdatering innan stängning för dagen
                        </h2>
                      </div>
                    </div>
                    <p className="text-sm text-[#6B6158] max-w-2xl">
                      Kort och rakt på sak. Fyll i tider, uppdatering och överlämning.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-4 space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                      {completedTasks.length} klara · {incompleteTasks.length} kvar
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Uppgifter markerade som slutförda</p>
                      {completedTasks.length === 0 ? (
                        <div className="text-sm text-[#8A8177] mt-1">Inga markerade ännu.</div>
                      ) : (
                        <ul className="mt-2 space-y-1 text-sm text-[#6B6158]">
                          {completedTasks.map((task) => (
                            <li key={`done-${task.id}`} className="flex items-start gap-2">
                              <span className="mt-1 w-2 h-2 rounded-full bg-[#a0c81d]" />
                              <span>{task.title}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Uppgifter som inte slutförts</p>
                      {incompleteTasks.length === 0 ? (
                        <div className="text-sm text-[#8A8177] mt-1">Inga öppna uppgifter.</div>
                      ) : (
                        <ul className="mt-2 space-y-1 text-sm text-[#6B6158]">
                          {incompleteTasks.map((task) => (
                            <li key={`todo-${task.id}`} className="flex items-start gap-2">
                              <span className="mt-1 w-2 h-2 rounded-full bg-[#E6E1D8]" />
                              <span>{task.title}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Datum</label>
                      <input
                        type="date"
                        value={reportForm.date}
                        onChange={(event) => setReportForm((prev) => ({ ...prev, date: event.target.value }))}
                        className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Starttid</label>
                      <input
                        type="time"
                        value={reportForm.startTime}
                        onChange={(event) => setReportForm((prev) => ({ ...prev, startTime: event.target.value }))}
                        className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                        required
                        disabled={!!shiftStartedAt}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Sluttid</label>
                      <input
                        type="time"
                        value={reportForm.endTime}
                        onChange={(event) => setReportForm((prev) => ({ ...prev, endTime: event.target.value }))}
                        className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                        required
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 text-sm text-[#3D3D3D]">
                    <input
                      type="checkbox"
                      checked={reportForm.overtime}
                      onChange={(event) => setReportForm((prev) => ({ ...prev, overtime: event.target.checked }))}
                      className="accent-[#a0c81d]"
                    />
                    Utanför ordinarie arbetstid
                  </label>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                      Jag gjorde (en summering av dagens arbete)
                    </label>
                    <textarea
                      value={reportForm.did}
                      onChange={(event) => setReportForm((prev) => ({ ...prev, did: event.target.value }))}
                      rows={3}
                      className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                      placeholder="Jag gjorde..."
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Att prioritera imorgon</label>
                    <textarea
                      value={reportForm.handover}
                      onChange={(event) => setReportForm((prev) => ({ ...prev, handover: event.target.value }))}
                      rows={3}
                      className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
                      placeholder="Om något behöver prioriteras imorgon..."
                      required={incompleteTasks.length > 0}
                    />
                  </div>

                  {reportError && (
                    <div className="rounded-2xl border border-rose-400/40 bg-rose-100/70 p-4 text-rose-800 text-sm">
                      {reportError}
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={reportStatus === 'sending'}
                      className="px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] font-black uppercase tracking-widest text-xs hover:bg-[#5C7A12] transition-all disabled:opacity-60"
                    >
                      {reportStatus === 'sending' ? 'Skickar...' : 'Skicka rapport'}
                    </button>
                    {reportStatus === 'success' && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                        Rapport skickad
                      </span>
                    )}
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'AGENDA' && (
              <div className="space-y-8 animate-fade-in">
                <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_20px_60px_rgba(61,61,61,0.18)] ring-1 ring-black/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Data</p>
                      <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D] tracking-tight">
                        Din insats i siffror
                      </h1>
                    </div>
                  </div>
                  <p className="text-[#6B6158] text-sm max-w-2xl">
                    Bra jobbat. Här ser du vad du har hunnit med och vad du lämnat vidare till teamet.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-[#DAD1C5] p-5 shadow-[0_16px_40px_rgba(61,61,61,0.12)]">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Slutförda uppgifter</div>
                    <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{dataStats.completedTasks}</div>
                    <div className="text-xs text-[#6B6158] mt-1">Totalt markerade</div>
                  </div>
                  <div className="bg-white rounded-2xl border border-[#DAD1C5] p-5 shadow-[0_16px_40px_rgba(61,61,61,0.12)]">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Rapporter</div>
                    <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{dataStats.reportCount}</div>
                    <div className="text-xs text-[#6B6158] mt-1">Skickade arbetsrapporter</div>
                  </div>
                  <div className="bg-white rounded-2xl border border-[#DAD1C5] p-5 shadow-[0_16px_40px_rgba(61,61,61,0.12)]">
                    <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Överlämningar</div>
                    <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{dataStats.handoverCount}</div>
                    <div className="text-xs text-[#6B6158] mt-1">Som du har skickat vidare</div>
                  </div>
                </div>

                {dataStatsError && (
                  <div className="rounded-2xl border border-amber-400/40 bg-amber-100/70 p-4 text-amber-900 text-sm">
                    {dataStatsError}
                  </div>
                )}

                <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_18px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5">
                  <h2 className="text-xl font-black text-[#3D3D3D] mb-3">Dina överlämningar</h2>
                  {handoverHistory.length === 0 ? (
                    <div className="text-sm text-[#8A8177]">Inga överlämningar sparade ännu.</div>
                  ) : (
                    <div className="space-y-3 text-sm text-[#6B6158]">
                      {handoverHistory.map((item, index) => {
                        const key = `${item.created_at}-${index}`;
                        const isExpanded = !!expandedHandovers[key];
                        const preview = item.text.length > 140 ? `${item.text.slice(0, 140).trim()}…` : item.text;
                        return (
                          <div key={key} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177] mb-2">
                              {formatTimestamp(item.created_at)}
                            </div>
                            <div className="text-sm text-[#6B6158]">
                              {isExpanded ? item.text : preview}
                            </div>
                            {item.text.length > 140 && (
                              <button
                                type="button"
                                onClick={() => setExpandedHandovers((prev) => ({
                                  ...prev,
                                  [key]: !prev[key]
                                }))}
                                className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177] hover:text-[#3D3D3D] transition"
                              >
                                {isExpanded ? 'Visa mindre' : 'Visa mer'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { Intranet };
