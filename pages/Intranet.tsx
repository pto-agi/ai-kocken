import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ClipboardList, Loader2, RefreshCcw } from 'lucide-react';
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
  sessions_per_week: number | null;
  refill_products: string[] | null;
  auto_continue: string | null;
};

type CombinedSubmission =
  | { kind: 'start'; data: StartFormEntry }
  | { kind: 'uppfoljning'; data: UppfoljningEntry };

type FilterValue = 'uppfoljning' | 'start' | 'done';

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
  const [startEntries, setStartEntries] = useState<StartFormEntry[]>([]);
  const [uppfoljningar, setUppfoljningar] = useState<UppfoljningEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const isConfigured = isSupabaseConfigured();

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

  const filterOptions: Array<{ value: FilterValue; label: string; count: number }> = [
    { value: 'uppfoljning', label: 'Uppföljningar', count: counts.uppOpen },
    { value: 'start', label: 'Startinlämningar', count: counts.startOpen },
    { value: 'done', label: 'Genomförda', count: counts.done }
  ];

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

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-32 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10 animate-fade-in">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-10">
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

        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#DAD1C5] shadow-[0_20px_60px_rgba(61,61,61,0.18)] mb-8 ring-1 ring-black/5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border transition ${
                    filter === option.value
                      ? 'bg-[#a0c81d]/20 border-[#a0c81d]/40 text-[#5C7A12]'
                      : 'bg-white border-[#DAD1C5] text-[#6B6158] hover:border-[#a0c81d]/40'
                  }`}
                >
                  {option.label} ({option.count})
                </button>
              ))}
            </div>
            {lastUpdated && (
              <div className="text-xs text-[#8A8177]">
                Senast uppdaterad: {formatTimestamp(lastUpdated)}
              </div>
            )}
          </div>
        </div>

        {isLoading && combined.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-[#a0c81d]" />
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-3xl border border-[#DAD1C5] bg-white p-8 text-center text-[#6B6158] shadow-[0_12px_30px_rgba(61,61,61,0.12)]">
                Inga inlämningar matchar filtret.
              </div>
            ) : (
              filtered.map((submission) => {
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
                            ? `Fokus: ${truncate(formatList((data as StartFormEntry).focus_areas), 120)}`
                            : truncate((data as UppfoljningEntry).summary_feedback, 140)}
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
                                <InfoRow label="Önskat startdatum" value={formatDateOnly(data.desired_start_date)} />
                                <InfoRow label="Pass per vecka" value={data.sessions_per_week || '—'} />
                                <InfoRow label="Fokusområden" value={formatList(data.focus_areas)} />
                              </div>
                            </section>

                            <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Grunddata</h4>
                              <div className="space-y-3">
                                <InfoRow label="Vikt" value={formatNumber(data.weight_kg, ' kg')} />
                                <InfoRow label="Längd" value={formatNumber(data.height_cm, ' cm')} />
                                <InfoRow label="Ålder" value={formatNumber(data.age)} />
                              </div>
                            </section>

                            <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Mål & bakgrund</h4>
                              <div className="space-y-3">
                                <InfoRow label="Målbeskrivning" value={data.goal_description || '—'} />
                                <InfoRow label="Skador" value={data.injuries || '—'} />
                                <InfoRow label="Träningserfarenhet" value={data.training_experience || '—'} />
                                <InfoRow label="Aktivitet 6 månader" value={data.activity_last_6_months || '—'} />
                                <InfoRow label="Kosthållning 6 månader" value={data.diet_last_6_months || '—'} />
                              </div>
                            </section>

                            <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Träningsupplägg</h4>
                              <div className="space-y-3">
                                <InfoRow label="Träningsformer" value={formatList(data.training_forms)} />
                                <InfoRow label="Träningsformer annat" value={data.training_forms_other || '—'} />
                                <InfoRow label="Träningsplatser" value={formatList(data.training_places)} />
                                <InfoRow label="Träningsplatser annat" value={data.training_places_other || '—'} />
                                <InfoRow label="Pass/vecka (detalj)" value={data.sessions_per_week_other || '—'} />
                              </div>
                            </section>

                            <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Kroppsmått</h4>
                              <div className="space-y-3">
                                <InfoRow label="Mått (cm)" value={buildMeasurements(data)} />
                              </div>
                            </section>
                          </div>
                        ) : (
                          <div className="mt-6 space-y-6">
                            <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Översikt</h4>
                              <div className="space-y-3">
                                <InfoRow label="Mål" value={data.goal || '—'} />
                                <InfoRow label="Pass per vecka" value={formatNumber(data.sessions_per_week)} />
                                <InfoRow label="Behåll upplägg" value={formatBoolean(data.quick_keep_plan)} />
                              </div>
                            </section>

                            <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Summering & feedback</h4>
                              <div className="space-y-3">
                                <InfoRow label="Sammanfattning" value={data.summary_feedback || '—'} />
                              </div>
                            </section>

                            <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Träning</h4>
                              <div className="space-y-3">
                                <InfoRow label="Övrig aktivitet" value={formatList(data.other_activity)} />
                                <InfoRow label="Träningsplatser" value={formatList(data.training_places)} />
                                <InfoRow label="Träningsplatser annat" value={data.training_places_other || '—'} />
                              </div>
                            </section>

                            <section className="rounded-2xl border border-[#DAD1C5] bg-[#F4F0E6] p-4">
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Produkter & fortsättning</h4>
                              <div className="space-y-3">
                                <InfoRow label="Påfyllnad" value={formatList(data.refill_products)} />
                                <InfoRow label="Auto fortsätt" value={data.auto_continue || '—'} />
                              </div>
                            </section>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { Intranet };
