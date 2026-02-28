import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Loader2, Search, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { formatDateKey } from '../utils/managerDashboard';
import { buildDailyAgendaSummary } from '../utils/managerAgenda';
import { groupNotesByUserDate } from '../utils/managerNotes';

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
  return new Date(value).toLocaleTimeString('sv-SE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Stockholm'
  });
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
};

type AgendaReport = {
  user_id: string;
  report_date: string;
  did: string | null;
  handover: string | null;
  start_time: string | null;
  end_time: string | null;
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

export const IntranetManager: React.FC = () => {
  const { profile } = useAuthStore();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<StaffProfile[]>([]);
  const [templates, setTemplates] = useState<AgendaTemplate[]>([]);
  const [completionItems, setCompletionItems] = useState<CompletionItem[]>([]);
  const [reports, setReports] = useState<AgendaReport[]>([]);
  const [startSubmissions, setStartSubmissions] = useState<SubmissionEntry[]>([]);
  const [uppSubmissions, setUppSubmissions] = useState<SubmissionEntry[]>([]);
  const [notes, setNotes] = useState<ManagerNote[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteStatus, setNoteStatus] = useState<Record<string, 'idle' | 'saving' | 'error'>>({});
  const [staffFilter, setStaffFilter] = useState('');
  const [expandedStaff, setExpandedStaff] = useState<Record<string, boolean>>({});
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [historyItemsByUser, setHistoryItemsByUser] = useState<Record<string, CompletionItem[]>>({});
  const [historyReportsByUser, setHistoryReportsByUser] = useState<Record<string, AgendaReport[]>>({});

  const selectedDate = useMemo(() => new Date(), []);
  const dateKey = useMemo(() => formatDateKey(selectedDate), [selectedDate]);
  const historyKeys = useMemo(() => getRecentDateKeys(selectedDate, 7), [selectedDate]);

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

        const [staffRes, templateRes, completionRes, reportRes, startRes, uppRes, notesRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name, email, is_staff').eq('is_staff', true),
          supabase.from('agenda_templates').select('id,title,schedule_days,sort_order,estimated_minutes').eq('is_active', true),
          supabase
            .from('agenda_completion_items')
            .select('user_id, report_date, task_id, completed_at, completed_by')
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
            .from('agenda_manager_notes')
            .select('id, user_id, report_date, task_id, note, created_by, created_at')
            .eq('report_date', dateKey)
        ]);

        if (staffRes.error) throw staffRes.error;
        if (templateRes.error) throw templateRes.error;
        if (completionRes.error) throw completionRes.error;
        if (reportRes.error) throw reportRes.error;
        if (startRes.error) throw startRes.error;
        if (uppRes.error) throw uppRes.error;
        if (notesRes.error) throw notesRes.error;
        if (!active) return;

        setStaff(staffRes.data || []);
        setTemplates(templateRes.data || []);
        setCompletionItems(completionRes.data || []);
        setReports(reportRes.data || []);
        setStartSubmissions(startRes.data || []);
        setUppSubmissions(uppRes.data || []);
        setNotes(notesRes.data || []);
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
  }, [dateKey]);

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

  const totals = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    Object.values(dailySummary.byUser).forEach((summary) => {
      totalTasks += summary.total;
      completedTasks += summary.completed;
    });
    return { totalTasks, completedTasks };
  }, [dailySummary]);

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
        .select('user_id, report_date, task_id, completed_at, completed_by')
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className={ui.card}>
            <div className={ui.label}>Klarmarkerat idag</div>
            <div className="mt-2 text-3xl font-black text-[#3D3D3D]">{totals.completedTasks}</div>
          </div>
          <div className={ui.card}>
            <div className={ui.label}>Totala uppgifter</div>
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
            const noteValue = noteDrafts[member.id] || '';
            const noteState = noteStatus[member.id] || 'idle';

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
                      {summary?.completed ?? 0}/{summary?.total ?? 0} uppgifter
                    </div>
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
                          {summary.tasks.map((task) => (
                            <div key={task.task_id} className="flex items-center justify-between rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 px-3 py-2">
                              <div>
                                <div className="text-sm font-bold text-[#3D3D3D]">{task.title}</div>
                                <div className="text-[11px] text-[#8A8177]">
                                  {task.is_completed ? `Klarmarkerad ${formatTime(task.completed_at)}` : 'Ej klarmarkerad'}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {task.requires_quality_check && (
                                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border ${task.is_completed ? 'border-emerald-400/40 text-emerald-700 bg-emerald-50' : 'border-slate-300 text-slate-500 bg-slate-50'}`}>
                                    Kvalitetscheck {task.is_completed ? 'klar' : 'saknas'}
                                  </span>
                                )}
                                {task.is_slow && (
                                  <span className="text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full border border-rose-400/40 text-rose-700 bg-rose-50">
                                    Lång tid
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                          {summary.tasks.length === 0 && (
                            <div className="text-sm text-[#8A8177]">Inga schemalagda uppgifter idag.</div>
                          )}
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
                        {userNotes.length === 0 && (
                          <div className="text-sm text-[#8A8177]">Inga noteringar idag.</div>
                        )}
                        {userNotes.map((note) => (
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-10">
          <div className="rounded-2xl border border-[#DAD1C5] bg-white p-5">
            <div className={ui.label}>Rapporter idag</div>
            <div className="mt-3 space-y-3 text-sm text-[#6B6158]">
              {reports.length === 0 && <div>Inga rapporter inskickade idag.</div>}
              {reports.map((report) => {
                const staffMember = staff.find((item) => item.id === report.user_id);
                return (
                  <div key={report.user_id} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                    <div className="text-sm font-bold text-[#3D3D3D]">{staffMember?.full_name || staffMember?.email || report.user_id}</div>
                    <div className="text-[11px] text-[#8A8177]">Start {report.start_time || '—'} · Slut {report.end_time || '—'}</div>
                    <div className="mt-2"><strong>Gjort:</strong> {report.did || '—'}</div>
                    <div><strong>Handover:</strong> {report.handover || '—'}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#DAD1C5] bg-white p-5">
            <div className={ui.label}>Inlämningar idag</div>
            <div className="mt-3 space-y-3 text-sm text-[#6B6158]">
              {(startSubmissions.length + uppSubmissions.length) === 0 && (
                <div>Inga formulär inskickade idag.</div>
              )}
              {startSubmissions.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                  <div className="text-sm font-bold text-[#3D3D3D]">Startformulär</div>
                  <div className="text-[11px] text-[#8A8177]">{item.first_name} {item.last_name} · {formatTime(item.created_at)}</div>
                </div>
              ))}
              {uppSubmissions.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl border border-[#E6E1D8] bg-[#F6F1E7]/70 p-3">
                  <div className="text-sm font-bold text-[#3D3D3D]">Uppföljning</div>
                  <div className="text-[11px] text-[#8A8177]">{item.first_name} {item.last_name} · {formatTime(item.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
