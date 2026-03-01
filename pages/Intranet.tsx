import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ClipboardList, Copy, FileText, LayoutDashboard, Loader2, Package, RefreshCcw, Trash2, X, Circle, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { buildCompletionItemAction } from '../utils/agendaCompletionItems';
import { buildAgendaItemsForDate } from '../utils/agendaTaskCatalog';
import { buildAgendaCustomTaskRange } from '../utils/agendaCustomTaskRange';

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
  estimated_minutes?: number | null;
};

type ManagerCustomTask = {
  id: string;
  report_date: string;
  title: string;
  estimated_minutes: number | null;
  is_active: boolean;
};

type ManagerTaskRemoval = {
  user_id: string;
  report_date: string;
  task_id: string;
  is_removed: boolean;
};

type AgendaItem = {
  id: string;
  title: string;
  inputType: 'none' | 'count' | 'text';
  sortOrder: number;
  count?: string | number | null;
  estimatedMinutes?: number | null;
};

type FilterValue = 'uppfoljning' | 'start' | 'done';
type StaffTab = 'OVERVIEW' | 'BASE' | 'REPORT' | 'SHIP' | 'AGENDA';

const REPORT_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1514319/ucizdpt/';
const REPORT_OVERTIME_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1514319/ucicwgs/';
const SHIPMENTS_STORAGE_KEY = 'staff-shipments';
const AHEAD_ELIGIBLE_TASKS = ['E-Handel/Lager', 'Förbered etiketter', 'Follow-Ups', 'Sociala medier'];

const normalizeAgendaTitle = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const AGENDA_CHECKLISTS: Record<
  string,
  {
    headline: string;
    items: Array<{
      title: string;
      tooltip: string;
      example?: {
        intro: string;
        segments: Array<{ label: string; text: string }>;
      };
    }>;
  }
> = {
  [normalizeAgendaTitle('Startupplägg')]: {
    headline: 'Checklistor för kvalitetssäkring baserat på uppgiften',
    items: [
      {
        title: 'Mål, skador och erfarenhet är inlagda',
        tooltip: 'Tydligt strukturerat i klientprofilen utifrån startformuläret.'
      },
      {
        title: 'Upplägget ger en bra beskrivning och seriöst namn',
        tooltip: 'Standard: [Uppläggets namn] - [Klientens namn]. Rensa siffror/format och välj professionella övnings-/videoval.'
      },
      {
        title: 'Övningar matchar klientens nivå',
        tooltip: 'Anpassa efter ålder, erfarenhet och mål. Ex: mer maskiner för äldre/ovana.'
      },
      {
        title: 'Kalendern är rimligt upplagd',
        tooltip: 'Fördelning mellan dagar tar hänsyn till återhämtning och önskemål.'
      }
    ]
  },
  [normalizeAgendaTitle('Uppföljningsupplägg')]: {
    headline: 'Kvalitetssäkra uppföljningen i 3 steg',
    items: [
      {
        title: 'Historiken är genomläst',
        tooltip: 'Nya uppföljningen + app-anteckningar. Ta bort övningar kunden ogillat.'
      },
      {
        title: 'Beskrivningen är unik',
        tooltip: 'Rensa standardtexter och spegla månadens syfte.'
      },
      {
        title: 'Valen är kommunicerade',
        tooltip: 'Passen ligger logiskt och klienten har fått en kort förklaring.'
      }
    ]
  },
  [normalizeAgendaTitle('Ärenden')]: {
    headline: 'Kvalitetssäkra ärenden innan klarmarkering',
    items: [
      {
        title: 'Planeringsändringar är dokumenterade',
        tooltip: 'Allt som påverkar planeringen är inlagt i profilen.'
      },
      {
        title: 'Klienten är informerad',
        tooltip: 'Meddelande skickat till berörda klienter.'
      }
    ]
  },
  [normalizeAgendaTitle('App')]: {
    headline: 'Svarsstandard i appen (kvalitetssäkring)',
    items: [
      {
        title: 'Tydlig struktur och bekräftelse',
        tooltip: 'Svara i segment med dubbelradbrytning och bekräfta kundens fråga i texten.',
        example: {
          intro: 'Exempelsvar med segment och bekräftelse:',
          segments: [
            {
              label: 'Hälsning',
              text: 'Hej Lisa!'
            },
            {
              label: 'Bekräftelse',
              text: 'Kul att övningen kändes bra! Angående ditt vätskeintag:'
            },
            {
              label: 'Svar',
              text: 'Sikta på 2–2,5 liter per dag och lägg till ett extra glas på träningsdagar. Om du känner dig trött kan du även öka saltintaget lite under varma dagar.'
            },
            {
              label: 'Avslut',
              text: 'Säg till om jag kan hjälpa till med något annat!\n// Simon'
            }
          ]
        }
      },
      {
        title: 'Alltid sista ordet',
        tooltip: 'Avsluta med en tydlig uppmaning, t.ex. “Säg till om jag kan hjälpa till med något annat” eller “Vill du att jag lägger in det?”'
      }
    ]
  }
};

type OrderImportItem = {
  product_id: string | null;
  name: string | null;
  sku: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  currency: string | null;
};

type OrderImportResult = {
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  shipping: {
    name: string | null;
    line1: string | null;
    line2: string | null;
    postal_code: string | null;
    city: string | null;
    country: string | null;
    phone: string | null;
  };
  items: OrderImportItem[];
  totals: {
    subtotal: number | null;
    shipping: number | null;
    discount: number | null;
    total: number | null;
    currency: string | null;
  };
  order_reference: string | null;
  notes: string[];
  shipping_requirements: {
    required_fields: string[];
    missing_fields: string[];
    can_ship: boolean;
  };
  customer_requirements: {
    required_fields: string[];
    missing_fields: string[];
    has_minimum: boolean;
  };
};

type ShipmentStatus = {
  labelPrinted: boolean;
  handledAt?: string | null;
};

type ShipmentEntry = {
  id: string;
  createdAt: string;
  updatedAt?: string | null;
  data: OrderImportResult;
  status: ShipmentStatus;
  createdBy?: string | null;
};

const ORDER_IMPORT_PRODUCTS = [
  { id: 'klientpaket', title: 'Klientpaket', aliases: ['KLIENTPAKET'], sku: '25261' },
  { id: 'hydro-pulse', title: 'Hydro Pulse', aliases: ['HYDRO PULSE', 'HYDROPULSE'] },
  { id: 'bcaa', title: 'BCAA', aliases: ['BCAA'] },
  { id: 'omega-3', title: 'Omega 3', aliases: ['OMEGA 3', 'OMEGA-3'] },
  { id: 'magnesium', title: 'Magnesium', aliases: ['MAGNESIUM'] },
  { id: 'multivitamin', title: 'Multivitamin', aliases: ['MULTIVITAMIN'] }
];

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

const formatReportList = (value?: string[] | string | null) => {
  if (Array.isArray(value)) return formatList(value);
  if (typeof value === 'string' && value.trim().length > 0) return value;
  return '—';
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

const parseEstimatedMinutes = (value?: number | string | null) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const numeric = Number(normalized.replace(/[^0-9.]/g, ''));
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const formatMinutesTotal = (value: number) => {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
};

const formatMoney = (value?: number | null, currency: string | null = 'SEK') => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const formatted = value.toLocaleString('sv-SE', { maximumFractionDigits: 2 });
  return `${formatted} ${currency || 'SEK'}`;
};

const truncate = (value?: string | null, maxLength = 160) => {
  if (!value) return '—';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}…`;
};

const formatDateInput = (date: Date) => date.toLocaleDateString('sv-SE');

const createLocalId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeShipmentRow = (row: any): ShipmentEntry | null => {
  if (!row || typeof row !== 'object') return null;
  const data = row.data as OrderImportResult | undefined;
  if (!data || typeof data !== 'object') return null;
  const status = row.status as ShipmentStatus | undefined;
  const createdAt = typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : null;
  const safeStatus: ShipmentStatus = {
    labelPrinted: Boolean(status?.labelPrinted),
    handledAt: status?.handledAt || (status?.labelPrinted ? (updatedAt || createdAt) : null)
  };
  return {
    id: String(row.id || createLocalId()),
    createdAt,
    updatedAt,
    createdBy: row.created_by ?? null,
    data,
    status: safeStatus
  };
};

const buildAddressLines = (shipping: OrderImportResult['shipping']) => {
  const lines = [
    shipping.name,
    shipping.line1,
    shipping.line2,
    [shipping.postal_code, shipping.city].filter(Boolean).join(' '),
    shipping.country,
    shipping.phone ? `Tel: ${shipping.phone}` : null
  ].filter(Boolean) as string[];
  return lines.length ? lines : ['—'];
};

const buildItemLines = (items: OrderImportItem[]) => {
  if (!items.length) return ['—'];
  return items.map((item) => {
    const qtyPart = item.quantity !== null && item.quantity !== undefined ? `${item.quantity} × ` : '';
    const name = item.name ?? 'Okänd produkt';
    const sku = item.sku ? ` (${item.sku})` : '';
    return `${qtyPart}${name}${sku}`.trim();
  });
};

const purgeOldHandledLocal = (entries: ShipmentEntry[]) => {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return entries.filter((entry) => {
    if (!entry.status.labelPrinted) return true;
    const handledAt = entry.status.handledAt || entry.updatedAt || entry.createdAt;
    if (!handledAt) return true;
    const timestamp = new Date(handledAt).getTime();
    if (Number.isNaN(timestamp)) return true;
    return timestamp >= cutoff;
  });
};

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
  const [activeTab, setActiveTab] = useState<StaffTab>('BASE');
  const [startEntries, setStartEntries] = useState<StartFormEntry[]>([]);
  const [uppfoljningar, setUppfoljningar] = useState<UppfoljningEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checklistModal, setChecklistModal] = useState<{
    dateKey: string;
    taskId: string;
    title: string;
    headline: string;
    items: Array<{
      title: string;
      tooltip: string;
      example?: {
        intro: string;
        segments: Array<{ label: string; text: string }>;
      };
    }>;
  } | null>(null);
  const [checklistChecks, setChecklistChecks] = useState<boolean[]>([]);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [checklistExample, setChecklistExample] = useState<{
    title: string;
    intro: string;
    segments: Array<{ label: string; text: string }>;
  } | null>(null);
  const [isReportExpanded, setIsReportExpanded] = useState(false);
  const [profilePanel, setProfilePanel] = useState<{
    userKey: string;
    fullName: string;
    email: string | null;
    submissions: CombinedSubmission[];
  } | null>(null);
  const [profilePanelSelectedId, setProfilePanelSelectedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [reportForm, setReportForm] = useState({
    date: formatDateInput(new Date()),
    startTime: '',
    endTime: '',
    did: '',
    handover: '',
    overtime: false
  });
  const [reportStatus, setReportStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [reportError, setReportError] = useState<string | null>(null);
  const [showAhead] = useState(false);
  const focusTasksFallback = useMemo(() => ([
    {
      id: 'focus-1',
      title: 'Uppföljningsmallar – gör dem vassare',
      description: 'Förtydliga mål, ta bort brus och lägg till 2 konkreta förbättringar som sparar tid.',
      done: false
    },
    {
      id: 'focus-2',
      title: 'Kvalitetssäkra 3 profiler',
      description: 'Läs mål + historik och uppdatera måltexten så den blir tydlig och mätbar.',
      done: false
    },
    {
      id: 'focus-3',
      title: 'Mikrochecklista för nya klienter',
      description: 'Skapa en 6–8 punkters check som minskar missar i första leveransen.',
      done: true
    }
  ]), []);
  const [focusTasks, setFocusTasks] = useState<Array<{ id: string; title: string; description: string; done: boolean }>>(focusTasksFallback);
  const [focusPage, setFocusPage] = useState(0);
  const [weeklyReports, setWeeklyReports] = useState<Record<string, any>>({});
  const isConfigured = isSupabaseConfigured();
  const [expandedWeekDays, setExpandedWeekDays] = useState<Record<string, boolean>>({});
  const [agendaCompletionByDate, setAgendaCompletionByDate] = useState<Record<string, string[]>>({});
  const selectedDate = useMemo(() => {
    if (!reportForm.date) return new Date();
    return new Date(`${reportForm.date}T00:00:00`);
  }, [reportForm.date]);

  const [agendaTemplates, setAgendaTemplates] = useState<AgendaTemplate[]>([]);
  const [managerCustomTasks, setManagerCustomTasks] = useState<ManagerCustomTask[]>([]);
  const [managerTaskRemovals, setManagerTaskRemovals] = useState<ManagerTaskRemoval[]>([]);
  const [agendaRefreshToken, setAgendaRefreshToken] = useState(0);
  const [agendaStatus, setAgendaStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [agendaError, setAgendaError] = useState<string | null>(null);

  const [handoverHistory, setHandoverHistory] = useState<Array<{ text: string; created_at: string; report_date?: string | null }>>([]);
  const [dataStats, setDataStats] = useState<{ completedTasks: number; reportCount: number; handoverCount: number }>({
    completedTasks: 0,
    reportCount: 0,
    handoverCount: 0
  });
  const [dataStatsError, setDataStatsError] = useState<string | null>(null);
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [reportHistoryError, setReportHistoryError] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<{
    type: 'report' | 'handover';
    data: any;
  } | null>(null);
  const [orderText, setOrderText] = useState('');
  const [orderParseStatus, setOrderParseStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [orderParseError, setOrderParseError] = useState<string | null>(null);
  const [orderDraft, setOrderDraft] = useState<OrderImportResult | null>(null);
  const [shipments, setShipments] = useState<ShipmentEntry[]>([]);
  const [shipmentsStatus, setShipmentsStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [shipmentsError, setShipmentsError] = useState<string | null>(null);
  const [copiedShipmentId, setCopiedShipmentId] = useState<string | null>(null);
  const [showHandledShipments, setShowHandledShipments] = useState(false);

  useEffect(() => {
    const todayKey = formatDateInput(new Date());
    setReportForm((prev) => {
      if (prev.date === todayKey) return prev;
      if (prev.startTime || prev.endTime || prev.did || prev.handover) return prev;
      return { ...prev, date: todayKey };
    });
  }, []);

  const toggleFocusTask = useCallback((taskId: string) => {
    setFocusTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, done: !task.done } : task))
    );
    if (!isConfigured) return;
    const next = focusTasks.find((task) => task.id === taskId);
    const nextDone = next ? !next.done : null;
    if (nextDone === null) return;
    supabase
      .from('agenda_projects')
      .update({ is_done: nextDone })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) {
          console.warn('Failed to update focus task', error);
        }
      });
  }, [focusTasks, isConfigured]);

  const focusTasksOrdered = useMemo(() => {
    const open = focusTasks.filter((task) => !task.done);
    const done = focusTasks.filter((task) => task.done);
    return [...open, ...done];
  }, [focusTasks]);

  const focusPageCount = useMemo(() => Math.max(1, Math.ceil(focusTasksOrdered.length / 3)), [focusTasksOrdered]);
  const safeFocusPage = Math.min(focusPage, focusPageCount - 1);
  const focusSliceStart = safeFocusPage * 3;
  const focusSlice = focusTasksOrdered.slice(focusSliceStart, focusSliceStart + 3);

  useEffect(() => {
    if (focusPage > focusPageCount - 1) {
      setFocusPage(Math.max(0, focusPageCount - 1));
    }
  }, [focusPage, focusPageCount]);

  const refreshDataOverview = useCallback(async () => {
    if (!session?.user?.id || !isStaff || !isConfigured) return;
    try {
      setDataStatsError(null);
      const [{ count: reportCount, error: reportError }, handoversRes, completionsRes] = await Promise.all([
        supabase
          .from('agenda_reports')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', session.user.id),
        supabase
          .from('agenda_reports')
          .select('handover, created_at, report_date')
          .eq('user_id', session.user.id)
          .not('handover', 'is', null)
          .neq('handover', '')
          .order('report_date', { ascending: false }),
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
        created_at: item.created_at,
        report_date: item.report_date
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
          .from('agenda_reports')
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
    const loadReportHistory = async () => {
      setReportHistoryError(null);
      try {
        const { data, error } = await supabase
          .from('agenda_reports')
          .select('*')
          .eq('user_id', session.user.id)
          .order('report_date', { ascending: false });
        if (error) throw error;
        if (!active) return;
        setReportHistory(data || []);
      } catch (err) {
        console.warn('Failed to load report history', err);
        if (!active) return;
        setReportHistory([]);
        setReportHistoryError('Kunde inte hämta rapporthistorik.');
      }
    };
    loadReportHistory();
    return () => {
      active = false;
    };
  }, [isConfigured, isStaff, session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id || !isStaff || !isConfigured) return;
    let active = true;
    const loadTemplates = async () => {
      setAgendaStatus('loading');
      setAgendaError(null);
      try {
        const { data, error } = await supabase
          .from('agenda_templates')
          .select('id,title,schedule_days,interval_weeks,input_type,sort_order,is_active,estimated_minutes')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        if (!active) return;
        setAgendaTemplates(data || []);
        setAgendaStatus('idle');
      } catch {
        if (!active) return;
        setAgendaStatus('error');
        setAgendaError('Kunde inte hämta basuppgifter.');
      }
    };
    loadTemplates();
    return () => {
      active = false;
    };
  }, [session?.user?.id, isStaff, isConfigured, agendaRefreshToken]);

  useEffect(() => {
    if (!isStaff) return;
    if (!isConfigured) {
      setManagerCustomTasks([]);
      return;
    }
    let active = true;
    const loadCustomTasks = async () => {
      try {
        const days = getWorkweekDates(selectedDate);
        const selectedDateKey = formatDateInput(selectedDate);
        const range = buildAgendaCustomTaskRange({
          selectedDateKey,
          workweekDateKeys: days.map((day) => formatDateInput(day))
        });
        const { data, error } = await supabase
          .from('agenda_manager_custom_tasks')
          .select('id, report_date, title, estimated_minutes, is_active')
          .eq('is_active', true)
          .gte('report_date', range.startKey)
          .lte('report_date', range.endKey)
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (!active) return;
        setManagerCustomTasks((data || []) as ManagerCustomTask[]);
      } catch (err) {
        console.warn('Failed to load manager custom tasks', err);
        if (!active) return;
        setManagerCustomTasks([]);
      }
    };
    loadCustomTasks();
    return () => {
      active = false;
    };
  }, [isConfigured, isStaff, selectedDate, agendaRefreshToken]);

  useEffect(() => {
    if (!session?.user?.id || !isStaff) return;
    if (!isConfigured) {
      setManagerTaskRemovals([]);
      return;
    }
    let active = true;
    const loadTaskRemovals = async () => {
      try {
        const days = getWorkweekDates(selectedDate);
        const selectedDateKey = formatDateInput(selectedDate);
        const range = buildAgendaCustomTaskRange({
          selectedDateKey,
          workweekDateKeys: days.map((day) => formatDateInput(day))
        });
        const { data, error } = await supabase
          .from('agenda_manager_task_removals')
          .select('user_id, report_date, task_id, is_removed')
          .gte('report_date', range.startKey)
          .lte('report_date', range.endKey);
        if (error) throw error;
        if (!active) return;
        setManagerTaskRemovals((data || []) as ManagerTaskRemoval[]);
      } catch (err) {
        console.warn('Failed to load manager task removals', err);
        if (!active) return;
        setManagerTaskRemovals([]);
      }
    };
    loadTaskRemovals();
    return () => {
      active = false;
    };
  }, [isConfigured, isStaff, selectedDate, session?.user?.id, agendaRefreshToken]);

  useEffect(() => {
    if (!isStaff) return;
    let active = true;
    const loadFocusTasks = async () => {
      if (!isConfigured) {
        setFocusTasks(focusTasksFallback);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('agenda_projects')
          .select('id,title,description,is_done,sort_order,is_active')
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (!active) return;
        const mapped = (data || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          done: !!item.is_done
        }));
        setFocusTasks(mapped.length > 0 ? mapped : focusTasksFallback);
      } catch (err) {
        console.warn('Failed to load focus tasks', err);
        if (!active) return;
        setFocusTasks(focusTasksFallback);
      }
    };
    loadFocusTasks();
    return () => {
      active = false;
    };
  }, [focusTasksFallback, isConfigured, isStaff]);

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
      } catch {
        setAgendaCompletionByDate((prev) => ({ ...prev, [dateKey]: [] }));
      }
    };
    loadCompletion();
    return () => {
      active = false;
    };
  }, [selectedDate, session?.user?.id, isStaff, isConfigured, agendaRefreshToken]);

  const resolveTaskCount = useCallback((_title: string, _report: any, _useFormFallback: boolean) => null, []);

  const getTasksForDate = useCallback((date: Date): AgendaItem[] => {
    const dayCode = getWeekdayCode(date);
    const key = formatDateInput(date);
    const merged = buildAgendaItemsForDate({
      dateKey: key,
      dayCode,
      templates: agendaTemplates,
      customTasks: managerCustomTasks,
      currentUserId: session?.user?.id,
      removals: managerTaskRemovals
    });
    return merged.map((item) => ({
      ...item,
      count: item.inputType === 'count' ? resolveTaskCount(item.title, weeklyReports[key], key === reportForm.date) : null
    }));
  }, [agendaTemplates, managerCustomTasks, managerTaskRemovals, reportForm.date, resolveTaskCount, session?.user?.id, weeklyReports]);

  const todayTasks = useMemo(() => getTasksForDate(selectedDate), [getTasksForDate, selectedDate]);
  const completedTaskIdsForDay = useMemo(() => {
    const key = formatDateInput(selectedDate);
    return new Set(agendaCompletionByDate[key] || []);
  }, [agendaCompletionByDate, selectedDate]);
  const reportHistoryMap = useMemo(() => {
    const map: Record<string, any> = {};
    reportHistory.forEach((report) => {
      if (report?.report_date) {
        map[report.report_date] = report;
      }
    });
    return map;
  }, [reportHistory]);
  const localReportSnapshot = useMemo(() => {
    if (!reportForm.date) return null;
    try {
      return JSON.parse(localStorage.getItem(`staff-report-${reportForm.date}`) || 'null');
    } catch {
      return null;
    }
  }, [reportForm.date]);
  const existingReport = reportHistoryMap[reportForm.date] || weeklyReports[reportForm.date] || localReportSnapshot;
  const isReportLocked = !!existingReport;
  const completedTasks = useMemo(() => (
    todayTasks.filter((task) => completedTaskIdsForDay.has(task.id))
  ), [completedTaskIdsForDay, todayTasks]);
  const incompleteTasks = useMemo(() => (
    todayTasks.filter((task) => !completedTaskIdsForDay.has(task.id))
  ), [completedTaskIdsForDay, todayTasks]);
  const estimatedMinutesTotal = useMemo(() => (
    todayTasks.reduce((sum, task) => {
      const minutes = parseEstimatedMinutes(task.estimatedMinutes);
      if (minutes === null) return sum;
      return sum + minutes;
    }, 0)
  ), [todayTasks]);

  const aheadTasks = useMemo(() => {
    if (!showAhead) return [];
    const days = getWorkweekDates(selectedDate);
    const baseTime = new Date(`${formatDateInput(selectedDate)}T00:00:00`).getTime();
    return days
      .filter((day) => day.getTime() > baseTime)
      .map((day) => {
        const key = formatDateInput(day);
        const tasks = getTasksForDate(day).filter((task) => (
          AHEAD_ELIGIBLE_TASKS.includes(task.title)
        ));
        return {
          date: day,
          dateKey: key,
          tasks
        };
      })
      .filter((entry) => entry.tasks.length > 0);
  }, [getTasksForDate, selectedDate, showAhead]);

  const performToggleAgendaTaskForDate = useCallback(async (dateKey: string, taskId: string) => {
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
      const action = buildCompletionItemAction({
        wasChecked,
        userId: session.user.id,
        reportDate: dateKey,
        taskId,
        source: 'staff'
      });

      if (action.type === 'insert') {
        const { error } = await supabase
          .from('agenda_completion_items')
          .upsert(action.payload, { onConflict: 'user_id,report_date,task_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agenda_completion_items')
          .delete()
          .eq('user_id', action.selector.user_id)
          .eq('report_date', action.selector.report_date)
          .eq('task_id', action.selector.task_id);
        if (error) throw error;
      }

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
  }, [agendaCompletionByDate, isConfigured, refreshDataOverview, session?.user?.id]);

  const toggleAgendaTaskForDate = useCallback(async (dateKey: string, task: AgendaItem) => {
    const current = new Set(agendaCompletionByDate[dateKey] || []);
    const shouldCheck = !current.has(task.id);
    if (shouldCheck) {
      const checklist = AGENDA_CHECKLISTS[normalizeAgendaTitle(task.title)];
      if (checklist) {
        setChecklistChecks(Array(checklist.items.length).fill(false));
        setChecklistError(null);
        setChecklistModal({
          dateKey,
          taskId: task.id,
          title: task.title,
          headline: checklist.headline,
          items: checklist.items
        });
        return;
      }
    }
    await performToggleAgendaTaskForDate(dateKey, task.id);
  }, [agendaCompletionByDate, performToggleAgendaTaskForDate]);

  const toggleAgendaTask = useCallback(async (task: AgendaItem) => {
    const dateKey = formatDateInput(selectedDate);
    await toggleAgendaTaskForDate(dateKey, task);
  }, [selectedDate, toggleAgendaTaskForDate]);

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

  useEffect(() => {
    if (typeof window === 'undefined' || isConfigured) return;
    try {
      const stored = localStorage.getItem(SHIPMENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setShipments(parsed);
        }
      }
    } catch (err) {
      console.warn('Failed to load stored shipments', err);
    }
  }, [isConfigured]);

  useEffect(() => {
    if (typeof window === 'undefined' || isConfigured) return;
    try {
      const cleaned = purgeOldHandledLocal(shipments);
      if (cleaned.length !== shipments.length) {
        setShipments(cleaned);
      }
      localStorage.setItem(SHIPMENTS_STORAGE_KEY, JSON.stringify(cleaned));
    } catch (err) {
      console.warn('Failed to persist shipments', err);
    }
  }, [shipments, isConfigured]);

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

  const getSubmissionUserKey = useCallback((entry: BaseSubmission) => {
    const emailKey = entry.email?.trim().toLowerCase();
    if (emailKey) return emailKey;
    const nameKey = `${entry.first_name || ''} ${entry.last_name || ''}`.trim().toLowerCase();
    if (nameKey) return nameKey;
    return entry.id;
  }, []);

  const submissionsByUser = useMemo(() => {
    const map: Record<string, CombinedSubmission[]> = {};
    combined.forEach((item) => {
      const key = getSubmissionUserKey(item.data);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    Object.values(map).forEach((list) => {
      list.sort((a, b) => {
        const aTime = new Date(a.data.created_at).getTime();
        const bTime = new Date(b.data.created_at).getTime();
        return bTime - aTime;
      });
    });
    return map;
  }, [combined, getSubmissionUserKey]);

  const counts = useMemo(() => {
    const startOpen = startEntries.filter((item) => !item.is_done).length;
    const uppOpen = uppfoljningar.filter((item) => !item.is_done).length;
    const done = combined.filter((item) => item.data.is_done).length;
    return { startOpen, uppOpen, done };
  }, [startEntries, uppfoljningar, combined]);

  const unreadShipments = useMemo(
    () => shipments.filter((entry) => !entry.status.labelPrinted),
    [shipments]
  );
  const handledShipments = useMemo(
    () => shipments.filter((entry) => entry.status.labelPrinted),
    [shipments]
  );

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

  const purgeOldHandledShipments = useCallback(async (entries: ShipmentEntry[]) => {
    if (!isConfigured || !entries.length) return 0;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const toDelete = entries.filter((entry) => {
      if (!entry.status.labelPrinted) return false;
      const handledAt = entry.status.handledAt || entry.updatedAt || entry.createdAt;
      if (!handledAt) return false;
      const timestamp = new Date(handledAt).getTime();
      if (Number.isNaN(timestamp)) return false;
      return timestamp < cutoff;
    });
    if (toDelete.length === 0) return 0;
    try {
      const { error } = await supabase
        .from('staff_shipments')
        .delete()
        .in('id', toDelete.map((entry) => entry.id));
      if (error) throw error;
      return toDelete.length;
    } catch (err) {
      console.warn('Failed to purge old handled shipments', err);
      return 0;
    }
  }, [isConfigured]);

  const loadShipments = useCallback(async () => {
    if (!isConfigured || !isStaff) return;
    setShipmentsStatus('loading');
    setShipmentsError(null);
    try {
      const { data, error } = await supabase
        .from('staff_shipments')
        .select('id, created_at, updated_at, created_by, data, status')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const mapped = (data || [])
        .map(normalizeShipmentRow)
        .filter(Boolean) as ShipmentEntry[];
      setShipments(mapped);
      const purged = await purgeOldHandledShipments(mapped);
      if (purged > 0) {
        setShipments((prev) => prev.filter((entry) => {
          if (!entry.status.labelPrinted) return true;
          const handledAt = entry.status.handledAt || entry.updatedAt || entry.createdAt;
          if (!handledAt) return true;
          const ageMs = Date.now() - new Date(handledAt).getTime();
          return ageMs < 30 * 24 * 60 * 60 * 1000;
        }));
      }
      setShipmentsStatus('idle');
    } catch (err) {
      console.warn('Failed to load shipments', err);
      setShipmentsStatus('error');
      setShipmentsError('Kunde inte hämta fraktlistan. Försök igen.');
    }
  }, [isConfigured, isStaff]);

  useEffect(() => {
    if (!session?.user?.id || !isStaff || !isConfigured) return;
    loadShipments();
  }, [isConfigured, isStaff, loadShipments, session?.user?.id]);

  const handleAnalyzeOrder = async () => {
    if (!orderText.trim()) return;
    setOrderParseStatus('loading');
    setOrderParseError(null);
    setOrderDraft(null);
    try {
      const response = await fetch('/api/order-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: orderText,
          products: ORDER_IMPORT_PRODUCTS,
          defaultCountry: 'Sverige'
        })
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || `Order-import failed (${response.status})`);
      }
      const data = await response.json();
      setOrderDraft(data);
      setOrderParseStatus('success');
    } catch (err: any) {
      console.error('Order import failed', err);
      setOrderParseStatus('error');
      setOrderParseError('Kunde inte analysera ordern. Kontrollera att texten är komplett och försök igen.');
    }
  };

  const handleAddShipment = async () => {
    if (!orderDraft) return;
    setShipmentsError(null);
    const entry: ShipmentEntry = {
      id: createLocalId(),
      createdAt: new Date().toISOString(),
      data: orderDraft,
      status: { labelPrinted: false, handledAt: null },
      createdBy: session?.user?.id || null
    };
    const applyLocal = () => {
      setShipments((prev) => [entry, ...prev]);
      setOrderDraft(null);
      setOrderText('');
      setOrderParseStatus('idle');
    };

    if (!isConfigured) {
      applyLocal();
      return;
    }

    setShipmentsStatus('loading');
    try {
      const { error } = await supabase
        .from('staff_shipments')
        .insert([{
          id: entry.id,
          created_at: entry.createdAt,
          created_by: entry.createdBy,
          data: entry.data,
          status: entry.status
        }]);
      if (error) {
        console.warn('Failed to save shipment', error);
        setShipmentsError('Kunde inte spara paketet. Försök igen.');
        setShipmentsStatus('error');
        return;
      }
      applyLocal();
      setShipmentsStatus('idle');
    } catch (err) {
      console.warn('Failed to save shipment', err);
      setShipmentsError('Kunde inte spara paketet. Försök igen.');
      setShipmentsStatus('error');
    }
  };

  const toggleShipmentStatus = async (id: string, key: keyof ShipmentStatus) => {
    setShipmentsError(null);
    const entry = shipments.find((item) => item.id === id);
    if (!entry) return;
    const toggled = !entry.status[key];
    const nextStatus: ShipmentStatus = {
      ...entry.status,
      [key]: toggled,
      handledAt: key === 'labelPrinted' ? (toggled ? new Date().toISOString() : null) : entry.status.handledAt
    };
    setShipments((prev) => prev.map((current) => (
      current.id === id ? { ...current, status: nextStatus, updatedAt: new Date().toISOString() } : current
    )));
    if (!isConfigured) return;
    try {
      const { error } = await supabase
        .from('staff_shipments')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) {
        console.warn('Failed to update shipment status', error);
        setShipmentsError('Kunde inte uppdatera paketet. Försök igen.');
        setShipmentsStatus('error');
        loadShipments();
      }
    } catch (err) {
      console.warn('Failed to update shipment status', err);
      setShipmentsError('Kunde inte uppdatera paketet. Försök igen.');
      setShipmentsStatus('error');
      loadShipments();
    }
  };

  const removeShipment = async (id: string) => {
    const prev = shipments;
    setShipments((current) => current.filter((entry) => entry.id !== id));
    if (!isConfigured) return;
    try {
      const { error } = await supabase
        .from('staff_shipments')
        .delete()
        .eq('id', id);
      if (error) {
        console.warn('Failed to delete shipment', error);
        setShipments(prev);
        setShipmentsError('Kunde inte ta bort paketet. Försök igen.');
        setShipmentsStatus('error');
      }
    } catch (err) {
      console.warn('Failed to delete shipment', err);
      setShipments(prev);
      setShipmentsError('Kunde inte ta bort paketet. Försök igen.');
      setShipmentsStatus('error');
    }
  };

  const copyShipmentAddress = async (entry: ShipmentEntry) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    const filteredLines = buildAddressLines(entry.data.shipping).filter((line) => line !== '—');
    if (filteredLines.length === 0) return;
    const lines = filteredLines.join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      setCopiedShipmentId(entry.id);
      setTimeout(() => setCopiedShipmentId((current) => (current === entry.id ? null : current)), 1600);
    } catch (err) {
      console.warn('Failed to copy address', err);
    }
  };

  const clearOrderDraft = () => {
    setOrderDraft(null);
    setOrderParseError(null);
    setOrderParseStatus('idle');
  };

  const handleReportSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setReportError(null);
    setReportStatus('idle');
    if (isReportLocked) {
      setReportError('Rapporten för valt datum är redan inskickad och kan inte redigeras.');
      setReportStatus('error');
      return;
    }

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
          overtime: reportForm.overtime,
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
          overtime: reportForm.overtime
        };
        const { error } = await supabase.from('agenda_reports').insert([reportPayload]);
        if (error) throw error;
        if (handoverText) {
          setHandoverHistory((prev) => ([
            { text: handoverText, created_at: new Date().toISOString(), report_date: reportForm.date },
            ...prev
          ]));
        }
        await refreshDataOverview();
      } catch (err) {
        console.warn('Failed to write agenda report', err);
      }
      setReportForm((prev) => ({
        ...prev,
        startTime: '',
        endTime: '',
        did: '',
        handover: '',
        overtime: false
      }));
    } catch (err) {
      console.error('Report webhook error:', err);
      setReportStatus('error');
      setReportError('Kunde inte skicka rapporten. Försök igen.');
    }
  };

  const renderSubmissionDetails = (submission: CombinedSubmission, options?: { compact?: boolean }) => {
    const wrapperClass = options?.compact ? 'mt-4 space-y-6' : 'mt-6 space-y-6';
    if (submission.kind === 'start') {
      return (
        <div className={wrapperClass}>
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
      );
    }

    return (
      <div className={wrapperClass}>
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
    );
  };

  const renderReportForm = (options?: { compact?: boolean; onCollapse?: () => void }) => {
    const compact = options?.compact ?? false;
    const containerClass = compact
      ? 'bg-white rounded-2xl p-5 md:p-6 border border-[#DAD1C5] shadow-[0_16px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5'
      : 'bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_20px_60px_rgba(61,61,61,0.18)] ring-1 ring-black/5';
    const spacingClass = compact ? 'space-y-4' : 'space-y-6';
    const headingClass = compact
      ? 'text-xl md:text-2xl font-black text-[#3D3D3D] tracking-tight'
      : 'text-2xl md:text-3xl font-black text-[#3D3D3D] tracking-tight';
    const textRows = compact ? 2 : 3;

    return (
      <form
        onSubmit={handleReportSubmit}
        className={`${containerClass} ${spacingClass}`}
      >
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className={`${compact ? 'w-9 h-9' : 'w-11 h-11'} rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]`}>
              <ClipboardList className={`${compact ? 'w-5 h-5' : 'w-6 h-6'}`} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Rapportering</p>
              <h2 className={headingClass}>
                {compact ? 'Dagens summering & prio imorgon' : 'Uppdatering innan stängning för dagen'}
              </h2>
            </div>
          </div>
          {options?.onCollapse && (
            <button
              type="button"
              onClick={options.onCollapse}
              className="mt-3 inline-flex items-center justify-center rounded-xl border border-[#DAD1C5] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#a0c81d]/40 transition"
            >
              Fäll in
            </button>
          )}
          <p className="text-sm text-[#6B6158] max-w-2xl">
            {compact
              ? 'Summera dagen kort och tydligt samt vad som är prio för nästa arbetsdag.'
              : 'Kort och rakt på sak. Fyll i tider, uppdatering och överlämning.'}
          </p>
        </div>

        {isReportLocked && (
          <div className="rounded-2xl border border-amber-400/40 bg-amber-100/70 p-4 text-amber-900 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              Rapporten för <span className="font-bold">{reportForm.date}</span> är redan inskickad och kan inte redigeras.
            </div>
            <button
              type="button"
              onClick={() => setActiveDetail({ type: 'report', data: existingReport })}
              className="px-4 py-2 rounded-xl border border-amber-300/60 bg-white text-[10px] font-black uppercase tracking-widest text-amber-900 hover:border-amber-400 transition"
            >
              Öppna rapport
            </button>
          </div>
        )}

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
              disabled={isReportLocked}
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
              disabled={isReportLocked}
            />
          </div>
        </div>

        <label className="flex items-center gap-3 text-sm text-[#3D3D3D]">
          <input
            type="checkbox"
            checked={reportForm.overtime}
            onChange={(event) => setReportForm((prev) => ({ ...prev, overtime: event.target.checked }))}
            className="accent-[#a0c81d]"
            disabled={isReportLocked}
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
            rows={textRows}
            className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
            placeholder="Jag gjorde..."
            required
            disabled={isReportLocked}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Att prioritera imorgon</label>
          <textarea
            value={reportForm.handover}
            onChange={(event) => setReportForm((prev) => ({ ...prev, handover: event.target.value }))}
            rows={textRows}
            className="w-full bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl px-4 py-3 text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none"
            placeholder="Om något behöver prioriteras imorgon..."
            required={incompleteTasks.length > 0}
            disabled={isReportLocked}
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
            disabled={reportStatus === 'sending' || isReportLocked}
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
    );
  };

  const handleChecklistToggle = (index: number) => {
    setChecklistChecks((prev) => prev.map((value, i) => (i === index ? !value : value)));
    setChecklistError(null);
  };

  const handleChecklistClose = () => {
    setChecklistModal(null);
    setChecklistChecks([]);
    setChecklistError(null);
    setChecklistExample(null);
  };

  const handleChecklistConfirm = async () => {
    if (!checklistModal) return;
    if (checklistChecks.some((value) => !value)) {
      setChecklistError('Du behöver kryssa i alla punkter innan du kan klarmarkera.');
      return;
    }
    const payload = checklistModal;
    handleChecklistClose();
    await performToggleAgendaTaskForDate(payload.dateKey, payload.taskId);
  };

  const handleOpenProfilePanel = (entry: BaseSubmission, currentKey?: string) => {
    const userKey = getSubmissionUserKey(entry);
    const submissions = submissionsByUser[userKey] || [];
    const fullName = `${entry.first_name} ${entry.last_name}`.trim() || 'Okänt namn';
    setProfilePanel({ userKey, fullName, email: entry.email || null, submissions });
    const initial = submissions.find((item) => `${item.kind}-${item.data.id}` !== currentKey) || submissions[0];
    setProfilePanelSelectedId(initial ? `${initial.kind}-${initial.data.id}` : null);
  };

  const handleCloseProfilePanel = () => {
    setProfilePanel(null);
    setProfilePanelSelectedId(null);
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
            <div
              key={key}
              id={`submission-${key}`}
              className="bg-white rounded-2xl border border-[#DAD1C5] shadow-[0_16px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5"
            >
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
                    {data.email ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenProfilePanel(data, key);
                        }}
                        className="text-sm text-[#6B6158] underline-offset-2 hover:underline hover:text-[#3D3D3D] transition"
                      >
                        {data.email}
                      </button>
                    ) : (
                      <p className="text-sm text-[#6B6158]">Ingen e-post</p>
                    )}
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

                  {renderSubmissionDetails(submission)}
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
                Inlämningar
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
                onClick={() => { setActiveTab('SHIP'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'SHIP'
                    ? 'bg-[#E8F1D5] text-[#3D3D3D] border border-[#a0c81d]/40 shadow-[0_0_20px_rgba(160,200,29,0.12)]'
                    : 'text-[#6B6158] hover:bg-[#E8F1D5]/50 border border-transparent'
                }`}
              >
                <span className={`p-2 rounded-xl ${activeTab === 'SHIP' ? 'bg-[#a0c81d] text-[#F6F1E7]' : 'bg-[#F6F1E7] text-[#8A8177]'}`}>
                  <Package className="w-4 h-4" />
                </span>
                <span className="flex items-center gap-2">
                  Frakt
                  {unreadShipments.length > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-black px-2 py-0.5">
                      {unreadShipments.length} oläst
                    </span>
                  )}
                </span>
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
                <section className="space-y-6 bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_18px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div>
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
                    <button
                      type="button"
                      onClick={() => setAgendaRefreshToken((prev) => prev + 1)}
                      className="self-start px-3 py-2 rounded-xl border border-[#DAD1C5] text-[10px] font-black uppercase tracking-[0.2em] text-[#6B6158] bg-white hover:border-[#a0c81d]/40 hover:text-[#3D3D3D] transition"
                    >
                      Uppdatera
                    </button>
                  </div>

                  <div className="pt-6 border-t border-[#E6E1D8] flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Återkommande punkter</p>
                        <h2 className="text-xl font-black text-[#3D3D3D]">Dagens operativa uppgifter</h2>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
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
                                  onChange={() => toggleAgendaTask(task)}
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
                                  {task.estimatedMinutes && (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] border border-[#E6E1D8] rounded-full px-2 py-0.5 bg-white/80">
                                      {task.estimatedMinutes}
                                    </span>
                                  )}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {todayTasks.length > 0 && (
                      <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                        Est {formatMinutesTotal(estimatedMinutesTotal)}
                      </div>
                    )}

                    {showAhead && (
                      <div className="mt-4 rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-4">
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Kommande uppgifter</div>
                        {aheadTasks.length === 0 ? (
                          <div className="text-sm text-[#8A8177]">Inga uppgifter att göra i förväg denna vecka.</div>
                        ) : (
                          <div className="space-y-3">
                            {aheadTasks.map((entry) => {
                              const completedIds = new Set(agendaCompletionByDate[entry.dateKey] || []);
                              return (
                                <div key={entry.dateKey} className="rounded-xl border border-[#E6E1D8] bg-white/70 p-3">
                                  <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">
                                    {entry.date.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  </div>
                                  <ul className="space-y-2 text-sm text-[#6B6158]">
                                    {entry.tasks.map((task) => {
                                      const isChecked = completedIds.has(task.id);
                                      return (
                                        <li key={`${entry.dateKey}-${task.id}`}>
                                          <label className="flex items-start gap-3 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => toggleAgendaTaskForDate(entry.dateKey, task)}
                                              className="mt-1 accent-[#a0c81d]"
                                            />
                                            <span className="flex items-baseline gap-2">
                                              <span className={isChecked ? 'line-through text-[#8A8177]' : undefined}>
                                                {task.title}
                                              </span>
                                              <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                                                {entry.date.toLocaleDateString('sv-SE', { weekday: 'short' })}
                                              </span>
                                              {task.estimatedMinutes && (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] border border-[#E6E1D8] rounded-full px-2 py-0.5 bg-white/80">
                                                  {task.estimatedMinutes}
                                                </span>
                                              )}
                                            </span>
                                          </label>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-6 border-t border-[#E6E1D8]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Sidoprojekt</p>
                          <h2 className="text-xl font-black text-[#3D3D3D]">Utveckling & Förbättring</h2>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[#8A8177]">
                            {focusTasks.filter((task) => !task.done).length} kvar
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setFocusPage((prev) => Math.max(0, prev - 1))}
                              className="w-8 h-8 rounded-full border border-[#E6E1D8] text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#a0c81d]/40 transition disabled:opacity-40"
                              disabled={safeFocusPage === 0}
                              aria-label="Föregående"
                            >
                              <ChevronLeft className="w-4 h-4 mx-auto" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFocusPage((prev) => Math.min(focusPageCount - 1, prev + 1))}
                              className="w-8 h-8 rounded-full border border-[#E6E1D8] text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#a0c81d]/40 transition disabled:opacity-40"
                              disabled={safeFocusPage >= focusPageCount - 1}
                              aria-label="Nästa"
                            >
                              <ChevronRight className="w-4 h-4 mx-auto" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {focusSlice.map((task) => (
                          <li key={task.id} className="rounded-2xl border border-[#E6E1D8] bg-white/80 p-4 shadow-[0_8px_18px_rgba(61,61,61,0.06)]">
                            <div className="flex items-start gap-3">
                              {task.done ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />
                              ) : (
                                <Circle className="w-4 h-4 text-orange-500 mt-0.5" />
                              )}
                              <div className="flex-1">
                                <div className={`text-sm font-semibold ${task.done ? 'line-through text-[#8A8177]' : 'text-[#3D3D3D]'}`}>
                                  {task.title}
                                </div>
                                <p className="text-[11px] text-[#6B6158] mt-1">
                                  {task.description}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => toggleFocusTask(task.id)}
                                  className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#8A8177] hover:text-[#3D3D3D] transition"
                                >
                                  {task.done ? 'Ångra' : 'Markera som klar'}
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                      {focusTasksOrdered.length > 3 && (
                        <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                          Visar {focusSliceStart + 1}–{Math.min(focusSliceStart + 3, focusTasksOrdered.length)} av {focusTasksOrdered.length}
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {isReportExpanded ? (
                  <div id="staff-reporting">
                    {renderReportForm({ compact: true, onCollapse: () => setIsReportExpanded(false) })}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-5 md:p-6 border border-[#DAD1C5] shadow-[0_16px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Rapportering</p>
                        <h3 className="text-lg md:text-xl font-black text-[#3D3D3D] mt-2">Avsluta dagen</h3>
                        <p className="text-sm text-[#6B6158] mt-2 max-w-2xl">
                          När du är klar för dagen, öppna rapporten och fyll i sammanfattning + prio för imorgon.
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsReportExpanded(true);
                            requestAnimationFrame(() => {
                              document.getElementById('staff-reporting')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            });
                          }}
                          className="px-5 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] font-black uppercase tracking-widest text-xs hover:bg-[#5C7A12] transition"
                        >
                          Avsluta dagen
                        </button>
                        {isReportLocked && (
                          <button
                            type="button"
                            onClick={() => setActiveDetail({ type: 'report', data: existingReport })}
                            className="px-4 py-2 rounded-xl border border-[#DAD1C5] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#a0c81d]/40 transition"
                          >
                            Öppna inskickad rapport
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

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
                        const completedIds = new Set(agendaCompletionByDate[key] || []);
                        const allDone = tasks.length > 0 && tasks.every((task) => completedIds.has(task.id));
                        const hasIncomplete = tasks.length > 0 && !allDone;
                        const isFutureDay = day.getTime() > selectedDate.getTime();
                        const isPastDay = day.getTime() < selectedDate.getTime();
                        const statusTone = allDone
                          ? 'border-emerald-400/50 bg-emerald-500/10'
                          : isPastDay && hasIncomplete
                            ? 'border-rose-400/50 bg-rose-500/10'
                            : 'border-[#E6E1D8] bg-[#F6F1E7]/70';
                        return (
                          <div key={key} className={`rounded-2xl border p-4 ${statusTone}`}>
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                              {day.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-sm font-black text-[#3D3D3D]">
                              {allDone ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Klar för dagen
                                </>
                              ) : isPastDay && hasIncomplete ? (
                                <>
                                  <AlertTriangle className="w-4 h-4 text-rose-600" /> Ej klar
                                </>
                              ) : isFutureDay ? (
                                'Kommande'
                              ) : hasIncomplete ? (
                                'Pågående'
                              ) : (
                                'Ingen agenda'
                              )}
                            </div>
                            {tasks.length === 0 ? (
                              <div className="mt-3 text-[11px] text-[#6B6158]">Ingen agenda.</div>
                            ) : (
                              <ul className="mt-3 space-y-2 text-[11px] text-[#6B6158]">
                                {visibleTasks.map((task) => {
                                  const isDone = completedIds.has(task.id);
                                  const showCount = task.count !== null && task.count !== undefined && `${task.count}` !== '';
                                  return (
                                    <li key={`${key}-${task.id}`} className="flex items-start gap-2">
                                      {isDone ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5" />
                                      ) : (
                                        <span className="w-3.5 h-3.5 rounded-full border border-[#DAD1C5] mt-0.5" />
                                      )}
                                        <span className={isDone ? 'line-through text-[#8A8177]' : 'text-[#3D3D3D]'}>
                                          {task.title}
                                        {showCount && (
                                          <span className="ml-1 text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                                            {task.count}
                                          </span>
                                        )}
                                        {task.estimatedMinutes && (
                                          <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-[#8A8177] border border-[#E6E1D8] rounded-full px-2 py-0.5 bg-white/80">
                                            {task.estimatedMinutes}
                                          </span>
                                        )}
                                      </span>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
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

              </div>
            )}

            {activeTab === 'REPORT' && (
              <div className="space-y-8 animate-fade-in">
                {renderReportForm()}
              </div>
            )}

            {activeTab === 'SHIP' && (
              <div className="space-y-8 animate-fade-in">
                <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_20px_60px_rgba(61,61,61,0.18)] ring-1 ring-black/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Frakt</p>
                      <h2 className="text-2xl md:text-3xl font-black text-[#3D3D3D] tracking-tight">
                        Paket & etiketter
                      </h2>
                    </div>
                  </div>
                  <p className="text-[#6B6158] text-sm max-w-2xl">
                    Klistra in en order från beställningssidan så får du en ren struktur med kund, adress och artiklar.
                    Lägg sedan till i paketlistan och klarmarkera när etikett är utskriven.
                  </p>
                </div>

                <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_18px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Snabb import</p>
                      <h3 className="text-xl font-black text-[#3D3D3D]">Kopiera från ordersidan</h3>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <textarea
                      value={orderText}
                      onChange={(event) => setOrderText(event.target.value)}
                      placeholder="Klistra in hela ordertexten här..."
                      className="w-full h-48 p-4 bg-[#F6F1E7] border border-[#E6E1D8] rounded-2xl text-sm text-[#3D3D3D] focus:border-[#a0c81d] outline-none resize-none font-mono"
                    />

                    {orderParseError && (
                      <div className="rounded-2xl border border-rose-400/40 bg-rose-100/70 p-4 text-rose-800 text-sm">
                        {orderParseError}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleAnalyzeOrder}
                        disabled={orderParseStatus === 'loading' || orderText.trim().length === 0}
                        className="px-5 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition disabled:opacity-60 flex items-center gap-2"
                      >
                        {orderParseStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                        Analysera
                      </button>
                      {orderDraft && (
                        <button
                          type="button"
                          onClick={clearOrderDraft}
                          className="px-4 py-3 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition"
                        >
                          Rensa resultat
                        </button>
                      )}
                    </div>
                  </div>

                  {orderDraft && (
                    <div className="mt-6 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <section className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Kund</h4>
                          <div className="space-y-2 text-sm text-[#3D3D3D]">
                            <div className="font-bold">{orderDraft.customer.name || '—'}</div>
                            <div>{orderDraft.customer.email || '—'}</div>
                            <div>{orderDraft.customer.phone || '—'}</div>
                          </div>
                          <div className="mt-3 text-xs text-[#8A8177]">
                            Order: {orderDraft.order_reference ? `#${orderDraft.order_reference}` : '—'}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Fraktadress</h4>
                          <div className="space-y-1 text-sm text-[#3D3D3D]">
                            {buildAddressLines(orderDraft.shipping).map((line) => (
                              <div key={line}>{line}</div>
                            ))}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Artiklar & summa</h4>
                          <div className="space-y-1 text-sm text-[#3D3D3D]">
                            {buildItemLines(orderDraft.items).map((line) => (
                              <div key={line}>{line}</div>
                            ))}
                          </div>
                          <div className="mt-3 text-xs text-[#8A8177] space-y-1">
                            <div>Delsumma: {formatMoney(orderDraft.totals.subtotal, orderDraft.totals.currency)}</div>
                            <div>Frakt: {formatMoney(orderDraft.totals.shipping, orderDraft.totals.currency)}</div>
                            <div className="font-bold text-[#3D3D3D]">
                              Totalt: {formatMoney(orderDraft.totals.total, orderDraft.totals.currency)}
                            </div>
                          </div>
                        </section>
                      </div>

                      {(orderDraft.notes?.length || 0) > 0 && (
                        <section className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Noteringar</h4>
                          <ul className="space-y-2 text-sm text-[#6B6158]">
                            {orderDraft.notes.map((note) => (
                              <li key={note} className="flex items-start gap-2">
                                <span className="mt-1 w-2 h-2 rounded-full bg-[#a0c81d]" />
                                <span>{note}</span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {orderDraft.shipping_requirements.missing_fields.length > 0 && (
                        <div className="rounded-2xl border border-rose-400/40 bg-rose-100/70 p-4 text-rose-800 text-sm">
                          Saknar fraktuppgifter: {orderDraft.shipping_requirements.missing_fields.join(', ')}
                        </div>
                      )}

                      {orderDraft.customer_requirements.missing_fields.length > 0 && (
                        <div className="rounded-2xl border border-rose-400/40 bg-rose-100/70 p-4 text-rose-800 text-sm">
                          Saknar kunduppgifter: {orderDraft.customer_requirements.missing_fields.join(', ')}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={handleAddShipment}
                          className="px-5 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition"
                        >
                          Lägg till i paketlistan
                        </button>
                        <button
                          type="button"
                          onClick={clearOrderDraft}
                          className="px-4 py-3 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition"
                        >
                          Ny analys
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_18px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Paketlista</p>
                      <h3 className="text-xl font-black text-[#3D3D3D]">Pågående utskick</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-[#8A8177]">
                        {isConfigured ? `${shipments.length} paket i Supabase` : `${shipments.length} paket sparade lokalt`}
                      </div>
                      {isConfigured && (
                        <button
                          type="button"
                          onClick={loadShipments}
                          className="px-3 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition flex items-center gap-2"
                          disabled={shipmentsStatus === 'loading'}
                        >
                          {shipmentsStatus === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                          Uppdatera
                        </button>
                      )}
                    </div>
                  </div>

                  {!isConfigured && (
                    <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-100/70 p-4 text-amber-800 text-sm">
                      Supabase är inte konfigurerat. Paketlistan sparas bara lokalt i den här webbläsaren.
                    </div>
                  )}

                  {shipmentsError && (
                    <div className="mb-4 rounded-2xl border border-rose-400/40 bg-rose-100/70 p-4 text-rose-800 text-sm">
                      {shipmentsError}
                    </div>
                  )}

                  {shipments.length === 0 ? (
                    <div className="text-sm text-[#8A8177]">Inga paket ännu. Lägg till en order ovan.</div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-[#6B6158] font-semibold">
                          Ohanterade: {unreadShipments.length}
                        </div>
                        {handledShipments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowHandledShipments((prev) => !prev)}
                            className="px-3 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition"
                          >
                            {showHandledShipments ? 'Dölj hanterade' : `Visa hanterade (${handledShipments.length})`}
                          </button>
                        )}
                      </div>

                      {unreadShipments.length === 0 ? (
                        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-100/70 p-4 text-emerald-800 text-sm">
                          Inga ohanterade paket just nu.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {unreadShipments.map((entry) => {
                            const missingShipping = entry.data.shipping_requirements?.missing_fields || [];
                            const missingCustomer = entry.data.customer_requirements?.missing_fields || [];
                            return (
                              <div key={entry.id} className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-4 space-y-4">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Order</div>
                                <div className="text-lg font-black text-[#3D3D3D]">
                                  {entry.data.order_reference ? `#${entry.data.order_reference}` : 'Order utan ID'}
                                </div>
                                <div className="text-xs text-[#8A8177]">Skapad {formatTimestamp(entry.createdAt)}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => copyShipmentAddress(entry)}
                                  className="px-3 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition flex items-center gap-2"
                                >
                                  <Copy className="w-4 h-4" />
                                  {copiedShipmentId === entry.id ? 'Kopierat' : 'Kopiera adress'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeShipment(entry.id)}
                                  className="px-3 py-2 rounded-xl border border-rose-200 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:border-rose-300 transition flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Ta bort
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-[#3D3D3D]">
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Kund</div>
                                <div className="font-bold">{entry.data.customer.name || '—'}</div>
                                <div>{entry.data.customer.email || '—'}</div>
                                <div>{entry.data.customer.phone || '—'}</div>
                              </div>
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Fraktadress</div>
                                {buildAddressLines(entry.data.shipping).map((line) => (
                                  <div key={line}>{line}</div>
                                ))}
                              </div>
                              <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Artiklar</div>
                                {buildItemLines(entry.data.items).map((line) => (
                                  <div key={line}>{line}</div>
                                ))}
                                <div className="mt-2 text-xs text-[#8A8177]">
                                  Total: {formatMoney(entry.data.totals.total, entry.data.totals.currency)}
                                </div>
                              </div>
                            </div>

                            {(missingShipping.length > 0 || missingCustomer.length > 0) && (
                              <div className="rounded-2xl border border-rose-400/40 bg-rose-100/70 p-3 text-rose-800 text-sm">
                                {missingShipping.length > 0 && (
                                  <div>Saknar fraktuppgifter: {missingShipping.join(', ')}</div>
                                )}
                                {missingCustomer.length > 0 && (
                                  <div>Saknar kunduppgifter: {missingCustomer.join(', ')}</div>
                                )}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-sm text-[#3D3D3D]">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={entry.status.labelPrinted}
                                  onChange={() => toggleShipmentStatus(entry.id, 'labelPrinted')}
                                  className="accent-[#a0c81d]"
                                />
                                Etikett utskriven
                              </label>
                            </div>
                          </div>
                        );
                          })}
                        </div>
                      )}

                      {showHandledShipments && handledShipments.length > 0 && (
                        <div className="space-y-4">
                          <div className="text-sm text-[#6B6158] font-semibold">Hanterade</div>
                          {handledShipments.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-[#E6E1D8] bg-white/70 p-4 space-y-3">
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Order</div>
                                  <div className="text-lg font-black text-[#3D3D3D]">
                                    {entry.data.order_reference ? `#${entry.data.order_reference}` : 'Order utan ID'}
                                  </div>
                                  <div className="text-xs text-[#8A8177]">Skapad {formatTimestamp(entry.createdAt)}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => copyShipmentAddress(entry)}
                                    className="px-3 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition flex items-center gap-2"
                                  >
                                    <Copy className="w-4 h-4" />
                                    {copiedShipmentId === entry.id ? 'Kopierat' : 'Kopiera adress'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removeShipment(entry.id)}
                                    className="px-3 py-2 rounded-xl border border-rose-200 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:border-rose-300 transition flex items-center gap-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Ta bort
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-[#3D3D3D]">
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Kund</div>
                                  <div className="font-bold">{entry.data.customer.name || '—'}</div>
                                  <div>{entry.data.customer.email || '—'}</div>
                                  <div>{entry.data.customer.phone || '—'}</div>
                                </div>
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Fraktadress</div>
                                  {buildAddressLines(entry.data.shipping).map((line) => (
                                    <div key={line}>{line}</div>
                                  ))}
                                </div>
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Artiklar</div>
                                  {buildItemLines(entry.data.items).map((line) => (
                                    <div key={line}>{line}</div>
                                  ))}
                                  <div className="mt-2 text-xs text-[#8A8177]">
                                    Total: {formatMoney(entry.data.totals.total, entry.data.totals.currency)}
                                  </div>
                                </div>
                              </div>
                              <div className="text-xs text-emerald-700 font-semibold uppercase tracking-widest">
                                Etikett utskriven
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <h2 className="text-xl font-black text-[#3D3D3D]">Dina rapporter</h2>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Senaste först</span>
                  </div>
                  {reportHistoryError && (
                    <div className="rounded-2xl border border-amber-400/40 bg-amber-100/70 p-4 text-amber-900 text-sm mb-4">
                      {reportHistoryError}
                    </div>
                  )}
                  {reportHistory.length === 0 ? (
                    <div className="text-sm text-[#8A8177]">Inga rapporter sparade ännu.</div>
                  ) : (
                    <div className="space-y-3 text-sm text-[#6B6158]">
                      {reportHistory.map((report) => {
                        const key = `${report.report_date || report.created_at || Math.random()}`;
                        const preview = report.did
                          ? (report.did.length > 120 ? `${report.did.slice(0, 120).trim()}…` : report.did)
                          : 'Ingen sammanfattning.';
                        return (
                          <div key={key} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">
                                {report.report_date ? formatDateOnly(`${report.report_date}T00:00:00`) : formatTimestamp(report.created_at)}
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveDetail({ type: 'report', data: report })}
                                className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] hover:text-[#3D3D3D] transition"
                              >
                                Öppna rapport
                              </button>
                            </div>
                            <div className="text-sm text-[#6B6158]">{preview}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_18px_45px_rgba(61,61,61,0.14)] ring-1 ring-black/5">
                  <h2 className="text-xl font-black text-[#3D3D3D] mb-3">Dina överlämningar</h2>
                  {handoverHistory.length === 0 ? (
                    <div className="text-sm text-[#8A8177]">Inga överlämningar sparade ännu.</div>
                  ) : (
                    <div className="space-y-3 text-sm text-[#6B6158]">
                      {handoverHistory.map((item, index) => {
                        const key = `${item.created_at}-${index}`;
                        const preview = item.text.length > 140 ? `${item.text.slice(0, 140).trim()}…` : item.text;
                        return (
                          <div key={key} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">
                                {formatTimestamp(item.created_at)}
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveDetail({ type: 'handover', data: item })}
                                className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] hover:text-[#3D3D3D] transition"
                              >
                                Öppna överlämning
                              </button>
                            </div>
                            <div className="text-sm text-[#6B6158]">{preview}</div>
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

      {activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div
            className="absolute inset-0 bg-[#3D3D3D]/60 backdrop-blur-sm"
            onClick={() => setActiveDetail(null)}
          />
          <div className="relative w-full max-w-3xl rounded-[2rem] border border-[#DAD1C5] bg-white p-6 md:p-8 shadow-[0_30px_80px_rgba(61,61,61,0.35)] ring-1 ring-black/5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">
                  {activeDetail.type === 'report' ? 'Rapport' : 'Överlämning'}
                </p>
                <h3 className="mt-2 text-2xl md:text-3xl font-black text-[#3D3D3D] tracking-tight">
                  {activeDetail.type === 'report'
                    ? (() => {
                        const reportDate = activeDetail.data?.report_date || activeDetail.data?.date;
                        return reportDate ? formatDateOnly(`${reportDate}T00:00:00`) : 'Rapportdetaljer';
                      })()
                    : formatTimestamp(activeDetail.data?.created_at)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetail(null)}
                className="px-4 py-2 rounded-xl border border-[#E6E1D8] text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition"
              >
                Stäng
              </button>
            </div>

            {activeDetail.type === 'report' ? (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <InfoRow
                    label="Datum"
                    value={activeDetail.data?.report_date || activeDetail.data?.date || '—'}
                  />
                  <InfoRow
                    label="Starttid"
                    value={activeDetail.data?.start_time || activeDetail.data?.startTime || '—'}
                  />
                  <InfoRow
                    label="Sluttid"
                    value={activeDetail.data?.end_time || activeDetail.data?.endTime || '—'}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow
                    label="Klart"
                    value={formatReportList(activeDetail.data?.completed_tasks)}
                  />
                  <InfoRow
                    label="Kvar"
                    value={formatReportList(activeDetail.data?.incomplete_tasks)}
                  />
                </div>

                <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Jag gjorde</div>
                  <div className="text-sm text-[#6B6158] whitespace-pre-line">
                    {activeDetail.data?.did || '—'}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-4">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Att prioritera</div>
                  <div className="text-sm text-[#6B6158] whitespace-pre-line">
                    {activeDetail.data?.handover || '—'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Överlämning</div>
                <div className="text-sm text-[#6B6158] whitespace-pre-line">
                  {activeDetail.data?.text || '—'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {checklistModal && (
        <>
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
            <div className="absolute inset-0 bg-black/40" onClick={handleChecklistClose} />
            <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-[#DAD1C5] shadow-[0_22px_60px_rgba(61,61,61,0.2)] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Checklista krävs</p>
                  <h3 className="text-xl md:text-2xl font-black text-[#3D3D3D] mt-2">{checklistModal.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={handleChecklistClose}
                  className="p-2 rounded-full border border-[#E6E1D8] text-[#8A8177] hover:text-[#3D3D3D] hover:border-[#a0c81d]/40 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-[#6B6158]">
                För att klarmarkera behöver du bekräfta att följande är gjort.
              </p>

              <div className="mt-4 rounded-2xl border border-[#E6E1D8] bg-[#F6F1E7]/60 p-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                  {checklistModal.headline}
                </span>
                <ul className="mt-4 space-y-3">
                  {checklistModal.items.map((item, index) => (
                    <li key={`${checklistModal.title}-${index}`} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checklistChecks[index] || false}
                        onChange={() => handleChecklistToggle(index)}
                        className="mt-1 accent-[#a0c81d]"
                      />
                      <div>
                        <div className="text-sm font-semibold text-[#3D3D3D]">{item.title}</div>
                        {item.tooltip && (
                          <div className="text-xs text-[#6B6158] mt-1">{item.tooltip}</div>
                        )}
                        {item.example && (
                          <button
                            type="button"
                            onClick={() => setChecklistExample({
                              title: item.title,
                              intro: item.example?.intro || '',
                              segments: item.example?.segments || []
                            })}
                            className="mt-2 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] transition"
                          >
                            Se exempel
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {checklistError && (
                <div className="mt-4 rounded-2xl border border-rose-400/40 bg-rose-100/70 p-3 text-rose-800 text-sm">
                  {checklistError}
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={handleChecklistClose}
                  className="px-4 py-2 rounded-xl border border-[#DAD1C5] text-xs font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D] hover:border-[#a0c81d]/40 transition"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={handleChecklistConfirm}
                  className="px-5 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] font-black uppercase tracking-widest text-xs hover:bg-[#5C7A12] transition"
                >
                  Bekräfta & klarmarkera
                </button>
              </div>
            </div>
          </div>

          {checklistExample && (
            <div className="fixed inset-0 z-[55] flex items-center justify-center px-4 py-8">
              <div className="absolute inset-0 bg-black/40" onClick={() => setChecklistExample(null)} />
              <div className="relative w-full max-w-xl rounded-2xl border border-[#DAD1C5] bg-white p-6 shadow-[0_22px_60px_rgba(61,61,61,0.25)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Se exempel</p>
                    <h4 className="text-lg font-black text-[#3D3D3D] mt-2">{checklistExample.title}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChecklistExample(null)}
                    className="p-2 rounded-full border border-[#E6E1D8] text-[#8A8177] hover:text-[#3D3D3D] hover:border-[#a0c81d]/40 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="mt-3 text-sm text-[#6B6158]">{checklistExample.intro}</p>
                <div className="mt-5 space-y-3">
                  {checklistExample.segments.map((segment) => (
                    <div key={segment.label} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">{segment.label}</div>
                      <div className="mt-2 text-sm text-[#3D3D3D] whitespace-pre-line">{segment.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </>
      )}

      {profilePanel && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={handleCloseProfilePanel} />
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-[#DAD1C5] shadow-[0_20px_50px_rgba(61,61,61,0.2)] p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8A8177]">Profilvy</p>
                <h4 className="text-lg font-black text-[#3D3D3D] mt-2">{profilePanel.fullName}</h4>
                {profilePanel.email && (
                  <div className="text-xs text-[#6B6158] mt-1">{profilePanel.email}</div>
                )}
              </div>
              <button
                type="button"
                onClick={handleCloseProfilePanel}
                className="p-2 rounded-full border border-[#E6E1D8] text-[#8A8177] hover:text-[#3D3D3D] hover:border-[#a0c81d]/40 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Tidigare inlämningar</div>
              {profilePanel.submissions.length === 0 ? (
                <div className="text-sm text-[#8A8177]">Inga inlämningar hittades.</div>
              ) : (
                <div className="space-y-2">
                  {profilePanel.submissions.map((item) => {
                    const itemKey = `${item.kind}-${item.data.id}`;
                    const isSelected = itemKey === profilePanelSelectedId;
                    const label = item.kind === 'start' ? 'Startformulär' : 'Uppföljning';
                    return (
                      <button
                        key={`profile-${itemKey}`}
                        type="button"
                        onClick={() => setProfilePanelSelectedId(itemKey)}
                        className={`w-full text-left rounded-xl border px-3 py-2 text-xs transition ${
                          isSelected
                            ? 'border-[#a0c81d]/60 bg-[#E8F1D5]'
                            : 'border-[#DAD1C5] bg-white hover:border-[#a0c81d]/40'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">{label}</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">•</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">
                            {formatDateOnly(item.data.created_at)}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-[#6B6158]">
                          {item.kind === 'start'
                            ? `Fokus: ${truncate(formatList(item.data.focus_areas), 90)}`
                            : truncate(item.data.summary_feedback, 90)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {profilePanelSelectedId && (
              <div className="mt-6">
                <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Inlämning</div>
                {(() => {
                  const selected = profilePanel.submissions.find(
                    (item) => `${item.kind}-${item.data.id}` === profilePanelSelectedId
                  );
                  return selected ? renderSubmissionDetails(selected, { compact: true }) : null;
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export { Intranet };
