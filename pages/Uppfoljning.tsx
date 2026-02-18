import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MessageSquareText } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type UppfoljningFormState = {
  firstName: string;
  lastName: string;
  email: string;
  quickKeepPlan: boolean;
  summaryFeedback: string;
  goal: string;
  otherActivity: string[];
  trainingPlaces: string[];
  trainingPlacesOther: string;
  homeEquipment: string[];
  homeEquipmentOther: string;
  sessionsPerWeek: string;
};

const goalOptions = [
  'Viktminskning/minskat kroppsfett',
  'Förbättrad konditionen/uthållighet',
  'Ökad styrka/muskelmassa'
];

const otherActivityOptions = [
  'Jag vill ha dagliga promenader schemalagt',
  'Jag vill ha veckovis vägning schemalagt'
];

const trainingPlaceOptions = [
  'Gym',
  'Hemma',
  'Utomhus',
  'Annat'
];

const homeEquipmentOptions = [
  'Hantlar',
  'Kettlebell',
  'Gummiband',
  'Träningsmatta',
  'Bänk',
  'Skivstång',
  'Pull-up bar',
  'TRX/Slings',
  'Löpband',
  'Cykel/Spinning',
  'Roddmaskin'
];

const emptyState: UppfoljningFormState = {
  firstName: '',
  lastName: '',
  email: '',
  quickKeepPlan: false,
  summaryFeedback: '',
  goal: '',
  otherActivity: [],
  trainingPlaces: [],
  trainingPlacesOther: '',
  homeEquipment: [],
  homeEquipmentOther: '',
  sessionsPerWeek: ''
};

const inputClass = 'w-full p-3 rounded-xl bg-[#F6F1E7]/70 border border-[#E6E1D8] text-[#3D3D3D] placeholder:text-[#8A8177] focus:border-[#a0c81d] focus:ring-0 outline-none transition';
const textareaClass = `${inputClass} min-h-[140px]`;
const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/1514319/uctkcj5/';

const parseIntSafe = (value: string) => {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const num = Number.parseInt(cleaned, 10);
  return Number.isFinite(num) ? num : null;
};

const toggleArrayValue = (list: string[], value: string) => (
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
);

const toWebhookBody = (data: Record<string, any>) => new URLSearchParams(
  Object.entries(data).map(([key, value]) => {
    if (value === undefined || value === null) return [key, ''];
    if (typeof value === 'string') return [key, value];
    if (typeof value === 'number' || typeof value === 'boolean') return [key, String(value)];
    return [key, JSON.stringify(value)];
  })
).toString();

const Uppfoljning: React.FC = () => {
  const { session, profile } = useAuthStore();
  const [form, setForm] = useState<UppfoljningFormState>(emptyState);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isConfigured = isSupabaseConfigured();
  const navigate = useNavigate();

  const fullName = useMemo(() => {
    const candidate = profile?.full_name || session?.user?.user_metadata?.full_name || '';
    return String(candidate || '').trim();
  }, [profile?.full_name, session?.user?.user_metadata?.full_name]);

  useEffect(() => {
    const email = session?.user?.email || '';
    if (!email && !fullName) return;
    const [first = '', ...rest] = fullName.split(' ');
    const last = rest.join(' ');

    setForm((prev) => ({
      ...prev,
      email: prev.email || email,
      firstName: prev.firstName || first,
      lastName: prev.lastName || last
    }));
  }, [session?.user?.email, fullName]);

  useEffect(() => {
    if (!isConfigured || !session?.user?.id) return;
    let isActive = true;

    const loadPrevious = async () => {
      const { data, error } = await supabase
        .from('uppfoljningar')
        .select('training_places, training_places_other, home_equipment, home_equipment_other')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isActive) return;
      if (error) {
        console.warn('Could not preload uppfoljning values:', error);
        return;
      }
      if (!data) return;

      setForm((prev) => {
        const next = { ...prev };
        if (Array.isArray(data.training_places) && prev.trainingPlaces.length === 0) {
          next.trainingPlaces = data.training_places;
        }
        if (data.training_places_other && !prev.trainingPlacesOther) {
          next.trainingPlacesOther = data.training_places_other;
        }
        if (Array.isArray(data.home_equipment) && prev.homeEquipment.length === 0) {
          next.homeEquipment = data.home_equipment;
        }
        if (data.home_equipment_other && !prev.homeEquipmentOther) {
          next.homeEquipmentOther = data.home_equipment_other;
        }
        return next;
      });
    };

    loadPrevious();

    return () => {
      isActive = false;
    };
  }, [isConfigured, session?.user?.id]);

  const validate = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return 'Fyll i för- och efternamn.';
    }
    if (!form.email.trim()) {
      return 'Fyll i en giltig e-postadress.';
    }
    if (!form.quickKeepPlan && !form.summaryFeedback.trim()) {
      return 'Fyll i summering & feedback.';
    }
    if (!form.quickKeepPlan && form.trainingPlaces.length === 0) {
      return 'Välj var du vill/kan träna.';
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!isConfigured) {
      setErrorMessage('Supabase är inte konfigurerat. Kontrollera VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY.');
      setStatus('error');
      return;
    }

    if (!session?.user?.id) {
      setErrorMessage('Du behöver vara inloggad för att skicka in formuläret.');
      setStatus('error');
      return;
    }

    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      setStatus('error');
      return;
    }

    setStatus('submitting');

    const payload = {
      user_id: session.user.id,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      email: form.email.trim(),
      quick_keep_plan: form.quickKeepPlan,
      summary_feedback: form.summaryFeedback.trim(),
      goal: form.goal || null,
      other_activity: form.otherActivity,
      training_places: form.trainingPlaces,
      training_places_other: form.trainingPlaces.includes('Annat') ? (form.trainingPlacesOther.trim() || null) : null,
      home_equipment: form.trainingPlaces.includes('Hemma') ? form.homeEquipment : [],
      home_equipment_other: form.trainingPlaces.includes('Hemma') ? (form.homeEquipmentOther.trim() || null) : null,
      sessions_per_week: parseIntSafe(form.sessionsPerWeek)
    };

    const { error } = await supabase
      .from('uppfoljningar')
      .insert([payload]);

    if (error) {
      setErrorMessage(error.message);
      setStatus('error');
      return;
    }

    try {
      const webhookPayload = {
        ...payload,
        source: 'uppfoljning',
        submitted_at: new Date().toISOString()
      };
      const body = toWebhookBody(webhookPayload);
      let res: Response | null = null;
      try {
        res = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
      } catch (err) {
        console.warn('Uppfoljning webhook primary failed, retrying no-cors:', err);
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body
        });
        res = null;
      }
      if (res && !res.ok) {
        console.warn('Uppfoljning webhook non-200:', res.status);
      }
    } catch (err) {
      console.warn('Uppfoljning webhook error:', err);
    }

    setStatus('success');
    navigate('/uppfoljning/tack');
  };

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-32 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-5xl mx-auto relative z-10 animate-fade-in">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                <MessageSquareText className="w-6 h-6" />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Uppföljning</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-[#3D3D3D] tracking-tight">Uppföljning</h1>
            <p className="text-[#6B6158] mt-3 max-w-2xl">Beskriv gärna vad som fungerat bra, vad som varit utmanande och om det är något särskilt du vill att vi tar med vid planeringen av ditt nästa upplägg.</p>
          </div>
        </div>

        <div className="bg-[#E8F1D5]/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-10 border border-[#E6E1D8] shadow-2xl">
          {!isConfigured && (
            <div className="mb-8 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200 text-sm">
              Supabase är inte konfigurerat ännu. Lägg in dina nycklar i <code className="text-amber-100">.env.local</code> för att kunna skicka formulär.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-12">
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-[#3D3D3D] uppercase tracking-wide">Kontaktuppgifter</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Förnamn<span className="text-[#a0c81d]">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    className={inputClass}
                    placeholder="Förnamn"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Efternamn<span className="text-[#a0c81d]">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    className={inputClass}
                    placeholder="Efternamn"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">E-post<span className="text-[#a0c81d]">*</span></label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className={inputClass}
                    placeholder="Din e-postadress"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Snabbval</label>
                  <label className="flex items-center gap-3 p-4 rounded-2xl border border-[#E6E1D8] hover:border-[#E6E1D8] transition">
                    <input
                      type="checkbox"
                      checked={form.quickKeepPlan}
                      onChange={(e) => setForm((prev) => ({ ...prev, quickKeepPlan: e.target.checked }))}
                      className="accent-[#a0c81d]"
                    />
                    <span className="text-sm font-semibold text-[#3D3D3D]">Jag vill fortsätta med samma upplägg</span>
                  </label>
                  {form.quickKeepPlan && (
                    <p className="text-xs text-[#8A8177] font-medium">
                      Då räcker det att du skickar in formuläret. Övriga fält är valfria.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-[#3D3D3D] uppercase tracking-wide">Summering & feedback</h2>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">
                  Summering & Feedback inför kommande planering
                  {!form.quickKeepPlan && <span className="text-[#a0c81d]">*</span>}
                </label>
                <textarea
                  value={form.summaryFeedback}
                  onChange={(e) => setForm((prev) => ({ ...prev, summaryFeedback: e.target.value }))}
                  className={textareaClass}
                  placeholder="Feedback från månaden som gått, vad du vill ha annorlunda och önskemål inför kommande planering."
                />
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-[#3D3D3D] uppercase tracking-wide">Mål & aktivitet</h2>
              </div>
              <div className="space-y-4">
                <div className="space-y-3">
                  <p className="text-sm text-[#6B6158]">Markera ditt mål</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goalOptions.map((option) => (
                      <label
                        key={option}
                        className={`flex items-center gap-3 p-4 rounded-2xl border transition ${form.goal === option ? 'border-[#a0c81d] bg-[#a0c81d]/10' : 'border-[#E6E1D8] hover:border-[#E6E1D8]'}`}
                      >
                        <input
                          type="radio"
                          name="goal"
                          value={option}
                          checked={form.goal === option}
                          onChange={() => setForm((prev) => ({ ...prev, goal: option }))}
                          className="accent-[#a0c81d]"
                        />
                        <span className="text-sm font-semibold text-[#3D3D3D]">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-[#6B6158]">Övrig aktivitet</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {otherActivityOptions.map((option) => (
                      <label
                        key={option}
                        className={`flex items-center gap-3 p-4 rounded-2xl border transition ${form.otherActivity.includes(option) ? 'border-[#a0c81d] bg-[#a0c81d]/10' : 'border-[#E6E1D8] hover:border-[#E6E1D8]'}`}
                      >
                        <input
                          type="checkbox"
                          checked={form.otherActivity.includes(option)}
                          onChange={() => setForm((prev) => ({ ...prev, otherActivity: toggleArrayValue(prev.otherActivity, option) }))}
                          className="accent-[#a0c81d]"
                        />
                        <span className="text-sm font-semibold text-[#3D3D3D]">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-[#3D3D3D] uppercase tracking-wide">Träningsupplägg</h2>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-[#6B6158]">
                  Jag vill/kan träna{!form.quickKeepPlan && <span className="text-[#a0c81d]">*</span>}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trainingPlaceOptions.map((option) => (
                    <label
                      key={option}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition ${form.trainingPlaces.includes(option) ? 'border-[#a0c81d] bg-[#a0c81d]/10' : 'border-[#E6E1D8] hover:border-[#E6E1D8]'}`}
                    >
                      <input
                        type="checkbox"
                        checked={form.trainingPlaces.includes(option)}
                        onChange={() => setForm((prev) => ({ ...prev, trainingPlaces: toggleArrayValue(prev.trainingPlaces, option) }))}
                        className="accent-[#a0c81d]"
                      />
                      <span className="text-sm font-semibold text-[#3D3D3D]">{option}</span>
                    </label>
                  ))}
                </div>
                {form.trainingPlaces.includes('Annat') && (
                  <input
                    type="text"
                    value={form.trainingPlacesOther}
                    onChange={(e) => setForm((prev) => ({ ...prev, trainingPlacesOther: e.target.value }))}
                    className={inputClass}
                    placeholder="Ange annan träningsplats"
                  />
                )}
                {form.trainingPlaces.includes('Hemma') && (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-[#6B6158]">Vilken utrustning har du hemma?</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {homeEquipmentOptions.map((option) => (
                        <label
                          key={option}
                          className={`flex items-center gap-3 p-4 rounded-2xl border transition ${
                            form.homeEquipment.includes(option)
                              ? 'border-[#a0c81d] bg-[#a0c81d]/10'
                              : 'border-[#E6E1D8] hover:border-[#E6E1D8]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={form.homeEquipment.includes(option)}
                            onChange={() => setForm((prev) => ({ ...prev, homeEquipment: toggleArrayValue(prev.homeEquipment, option) }))}
                            className="accent-[#a0c81d]"
                          />
                          <span className="text-sm font-semibold text-[#3D3D3D]">{option}</span>
                        </label>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={form.homeEquipmentOther}
                      onChange={(e) => setForm((prev) => ({ ...prev, homeEquipmentOther: e.target.value }))}
                      className={inputClass}
                      placeholder="Saknar du något i listan? Skriv här."
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Antal pass per vecka</label>
                <input
                  type="number"
                  min={0}
                  max={14}
                  value={form.sessionsPerWeek}
                  onChange={(e) => setForm((prev) => ({ ...prev, sessionsPerWeek: e.target.value }))}
                  className={inputClass}
                  placeholder="Ange antalet träningspass per vecka"
                />
              </div>
            </section>

            {errorMessage && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 text-sm">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full md:w-auto px-8 py-4 rounded-2xl bg-[#a0c81d] text-[#F6F1E7] font-black uppercase tracking-widest text-sm shadow-xl shadow-[#a0c81d]/20 hover:bg-[#5C7A12] transition flex items-center justify-center gap-2"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Skickar...
                  </>
                ) : (
                  'Skicka in uppföljning'
                )}
              </button>
              <span className="text-xs font-black uppercase tracking-widest text-[#8A8177]">"*" anger obligatoriska fält</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export { Uppfoljning };
