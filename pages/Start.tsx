import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Loader2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type StartFormState = {
  firstName: string;
  lastName: string;
  email: string;
  desiredStartDate: string;
  weightKg: string;
  heightCm: string;
  age: string;
  focusAreas: string[];
  goalDescription: string;
  injuries: string;
  trainingExperience: string;
  activityLast6Months: string;
  dietLast6Months: string;
  trainingForms: string[];
  trainingFormsOther: string;
  trainingPlaces: string[];
  trainingPlacesOther: string;
  sessionsPerWeek: string;
  sessionsPerWeekOther: string;
  showMeasurements: boolean;
  bodyMeasurements: {
    chestBack: string;
    armRight: string;
    armLeft: string;
    shoulders: string;
    waist: string;
    thighRight: string;
    thighLeft: string;
    calfRight: string;
    calfLeft: string;
  };
};

const focusOptions = [
  'Viktminskning/minskat kroppsfett',
  'Ökad styrka/muskelmassa',
  'Förbättrad kondition/uthållighet',
  'Förbättrad hälsa/välmående'
];

const trainingFormOptions = [
  'Styrketräning',
  'Konditionsträning',
  'Cirkelträning/HIIT',
  'Gruppträning',
  'Annat'
];

const trainingPlaceOptions = [
  'Gym',
  'Hemma',
  'Utomhus',
  'Annat'
];

const sessionsOptions = [
  { value: '1', label: '1 pass per vecka' },
  { value: '2', label: '2 pass per vecka' },
  { value: '3', label: '3 pass per vecka' },
  { value: '4', label: '4 pass per vecka' },
  { value: '5', label: '5 pass per vecka' },
  { value: 'none', label: 'Ingen träning' },
  { value: 'other', label: 'Annan' }
];

const emptyState: StartFormState = {
  firstName: '',
  lastName: '',
  email: '',
  desiredStartDate: '',
  weightKg: '',
  heightCm: '',
  age: '',
  focusAreas: [],
  goalDescription: '',
  injuries: '',
  trainingExperience: '',
  activityLast6Months: '',
  dietLast6Months: '',
  trainingForms: [],
  trainingFormsOther: '',
  trainingPlaces: [],
  trainingPlacesOther: '',
  sessionsPerWeek: '',
  sessionsPerWeekOther: '',
  showMeasurements: false,
  bodyMeasurements: {
    chestBack: '',
    armRight: '',
    armLeft: '',
    shoulders: '',
    waist: '',
    thighRight: '',
    thighLeft: '',
    calfRight: '',
    calfLeft: ''
  }
};

const inputClass = 'w-full p-3 rounded-xl bg-[#0f172a]/70 border border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-[#a0c81d] focus:ring-0 outline-none transition';
const textareaClass = `${inputClass} min-h-[120px]`;

const parseNumber = (value: string) => {
  const cleaned = value.replace(',', '.').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const parseIntSafe = (value: string) => {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const num = Number.parseInt(cleaned, 10);
  return Number.isFinite(num) ? num : null;
};

const toggleArrayValue = (list: string[], value: string) => (
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
);

const Start: React.FC = () => {
  const { session, profile } = useAuthStore();
  const [form, setForm] = useState<StartFormState>(emptyState);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isConfigured = isSupabaseConfigured();

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

  const fillExample = () => {
    setForm({
      firstName: 'Anna',
      lastName: 'Svensson',
      email: session?.user?.email || 'anna.svensson@example.com',
      desiredStartDate: '2026-03-01',
      weightKg: '68',
      heightCm: '170',
      age: '32',
      focusAreas: [
        'Viktminskning/minskat kroppsfett',
        'Förbättrad hälsa/välmående'
      ],
      goalDescription: 'Vill gå ner 5 kg och få bättre energi i vardagen.',
      injuries: 'Stel ländrygg, undviker tunga marklyft.',
      trainingExperience: 'Styrketränat 2-3 år, paus senaste året.',
      activityLast6Months: 'Promenader 2-3 gånger/vecka samt lätt styrka.',
      dietLast6Months: 'Blandkost, ibland oregelbundna måltider.',
      trainingForms: ['Styrketräning', 'Konditionsträning', 'Annat'],
      trainingFormsOther: 'Yoga',
      trainingPlaces: ['Gym', 'Hemma', 'Annat'],
      trainingPlacesOther: 'Utomhuspark',
      sessionsPerWeek: '3',
      sessionsPerWeekOther: '',
      showMeasurements: true,
      bodyMeasurements: {
        chestBack: '92',
        armRight: '30',
        armLeft: '29',
        shoulders: '105',
        waist: '78',
        thighRight: '56',
        thighLeft: '55',
        calfRight: '37',
        calfLeft: '36'
      }
    });
  };

  const validate = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return 'Fyll i för- och efternamn.';
    }
    if (!form.email.trim()) {
      return 'Fyll i en giltig e-postadress.';
    }
    if (!form.weightKg || !form.heightCm || !form.age) {
      return 'Fyll i vikt, längd och ålder.';
    }
    if (form.focusAreas.length === 0) {
      return 'Välj minst ett fokusområde.';
    }
    if (!form.sessionsPerWeek) {
      return 'Välj antal pass per vecka.';
    }
    if (form.sessionsPerWeek === 'other' && !form.sessionsPerWeekOther.trim()) {
      return 'Ange hur många pass per vecka du vill träna.';
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

    const sessionsLabel = sessionsOptions.find((option) => option.value === form.sessionsPerWeek)?.label || form.sessionsPerWeek;

    const payload = {
      user_id: session.user.id,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      email: form.email.trim(),
      desired_start_date: form.desiredStartDate || null,
      weight_kg: parseNumber(form.weightKg),
      height_cm: parseNumber(form.heightCm),
      age: parseIntSafe(form.age),
      focus_areas: form.focusAreas,
      goal_description: form.goalDescription.trim() || null,
      injuries: form.injuries.trim() || null,
      training_experience: form.trainingExperience.trim() || null,
      activity_last_6_months: form.activityLast6Months.trim() || null,
      diet_last_6_months: form.dietLast6Months.trim() || null,
      training_forms: form.trainingForms,
      training_forms_other: form.trainingForms.includes('Annat') ? (form.trainingFormsOther.trim() || null) : null,
      training_places: form.trainingPlaces,
      training_places_other: form.trainingPlaces.includes('Annat') ? (form.trainingPlacesOther.trim() || null) : null,
      sessions_per_week: sessionsLabel,
      sessions_per_week_other: form.sessionsPerWeek === 'other' ? (form.sessionsPerWeekOther.trim() || null) : null,
      measurement_chest_back: parseNumber(form.bodyMeasurements.chestBack),
      measurement_arm_right: parseNumber(form.bodyMeasurements.armRight),
      measurement_arm_left: parseNumber(form.bodyMeasurements.armLeft),
      measurement_shoulders: parseNumber(form.bodyMeasurements.shoulders),
      measurement_waist: parseNumber(form.bodyMeasurements.waist),
      measurement_thigh_right: parseNumber(form.bodyMeasurements.thighRight),
      measurement_thigh_left: parseNumber(form.bodyMeasurements.thighLeft),
      measurement_calf_right: parseNumber(form.bodyMeasurements.calfRight),
      measurement_calf_left: parseNumber(form.bodyMeasurements.calfLeft)
    };

    const { error } = await supabase
      .from('startformular')
      .insert([payload]);

    if (error) {
      setErrorMessage(error.message);
      setStatus('error');
      return;
    }

    setStatus('success');
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans pb-32 pt-24 px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-5xl mx-auto relative z-10 animate-fade-in">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                <ClipboardList className="w-6 h-6" />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Startformulär</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Nu är det dags att inleda planeringsarbetet</h1>
            <p className="text-slate-400 mt-3 max-w-2xl">Fyll i uppgifter kring mål, träningserfarenheter, skador och annan information som ligger till grund för din planering.</p>
          </div>
          <button
            type="button"
            onClick={fillExample}
            className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest text-slate-200 hover:bg-[#a0c81d]/20 hover:border-[#a0c81d]/40 transition"
          >
            Exempeldata
          </button>
        </div>

        <div className="bg-[#1e293b]/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-10 border border-white/5 shadow-2xl">
          {!isConfigured && (
            <div className="mb-8 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-200 text-sm">
              Supabase är inte konfigurerat ännu. Lägg in dina nycklar i <code className="text-amber-100">.env.local</code> för att kunna skicka formulär.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-12">
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-white uppercase tracking-wide">Kontaktuppgifter</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Förnamn<span className="text-[#a0c81d]">*</span></label>
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
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Efternamn<span className="text-[#a0c81d]">*</span></label>
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
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">E-post<span className="text-[#a0c81d]">*</span></label>
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
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Önskat startdatum</label>
                  <input
                    type="date"
                    value={form.desiredStartDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, desiredStartDate: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-white uppercase tracking-wide">Grunddata</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Kroppsvikt (kg)<span className="text-[#a0c81d]">*</span></label>
                  <input
                    type="number"
                    required
                    min={30}
                    max={300}
                    value={form.weightKg}
                    onChange={(e) => setForm((prev) => ({ ...prev, weightKg: e.target.value }))}
                    className={inputClass}
                    placeholder="Vikt"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Längd (cm)<span className="text-[#a0c81d]">*</span></label>
                  <input
                    type="number"
                    required
                    min={100}
                    max={250}
                    value={form.heightCm}
                    onChange={(e) => setForm((prev) => ({ ...prev, heightCm: e.target.value }))}
                    className={inputClass}
                    placeholder="Längd"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Ålder<span className="text-[#a0c81d]">*</span></label>
                  <input
                    type="number"
                    required
                    min={10}
                    max={120}
                    value={form.age}
                    onChange={(e) => setForm((prev) => ({ ...prev, age: e.target.value }))}
                    className={inputClass}
                    placeholder="Ålder"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-white uppercase tracking-wide">Fokusområden</h2>
              </div>
              <p className="text-sm text-slate-400">Din målsättning och vad du vill fokusera på. Det är möjligt att välja flera alternativ.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {focusOptions.map((option) => (
                  <label
                    key={option}
                    className={`flex items-center gap-3 p-4 rounded-2xl border transition ${form.focusAreas.includes(option) ? 'border-[#a0c81d] bg-[#a0c81d]/10' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <input
                      type="checkbox"
                      checked={form.focusAreas.includes(option)}
                      onChange={() => setForm((prev) => ({ ...prev, focusAreas: toggleArrayValue(prev.focusAreas, option) }))}
                      className="accent-[#a0c81d]"
                    />
                    <span className="text-sm font-semibold text-slate-200">{option}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-white uppercase tracking-wide">Mål & bakgrund</h2>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Målbeskrivning</label>
                  <textarea
                    value={form.goalDescription}
                    onChange={(e) => setForm((prev) => ({ ...prev, goalDescription: e.target.value }))}
                    className={textareaClass}
                    placeholder="Beskriv dina mål och vad du vill uppnå."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Eventuella skador</label>
                  <textarea
                    value={form.injuries}
                    onChange={(e) => setForm((prev) => ({ ...prev, injuries: e.target.value }))}
                    className={textareaClass}
                    placeholder="Ange skador eller begränsningar."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Träningserfarenheter</label>
                  <textarea
                    value={form.trainingExperience}
                    onChange={(e) => setForm((prev) => ({ ...prev, trainingExperience: e.target.value }))}
                    className={textareaClass}
                    placeholder="Berätta om dina tidigare träningserfarenheter."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Aktivitet senaste 6 månaderna</label>
                  <textarea
                    value={form.activityLast6Months}
                    onChange={(e) => setForm((prev) => ({ ...prev, activityLast6Months: e.target.value }))}
                    className={textareaClass}
                    placeholder="Beskriv din aktivitetsnivå de senaste 6 månaderna."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Kosthållning senaste 6 månaderna</label>
                  <textarea
                    value={form.dietLast6Months}
                    onChange={(e) => setForm((prev) => ({ ...prev, dietLast6Months: e.target.value }))}
                    className={textareaClass}
                    placeholder="Beskriv din kosthållning de senaste 6 månaderna."
                  />
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-white uppercase tracking-wide">Träningsupplägg</h2>
              </div>
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-sm text-slate-400">Vilka träningsformer vill du att vi planerar för? Det är möjligt att välja flera alternativ.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trainingFormOptions.map((option) => (
                      <label
                        key={option}
                        className={`flex items-center gap-3 p-4 rounded-2xl border transition ${form.trainingForms.includes(option) ? 'border-[#a0c81d] bg-[#a0c81d]/10' : 'border-white/10 hover:border-white/20'}`}
                      >
                        <input
                          type="checkbox"
                          checked={form.trainingForms.includes(option)}
                          onChange={() => setForm((prev) => ({ ...prev, trainingForms: toggleArrayValue(prev.trainingForms, option) }))}
                          className="accent-[#a0c81d]"
                        />
                        <span className="text-sm font-semibold text-slate-200">{option}</span>
                      </label>
                    ))}
                  </div>
                  {form.trainingForms.includes('Annat') && (
                    <input
                      type="text"
                      value={form.trainingFormsOther}
                      onChange={(e) => setForm((prev) => ({ ...prev, trainingFormsOther: e.target.value }))}
                      className={inputClass}
                      placeholder="Ange annan träningsform"
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-slate-400">Välj om du vill träna primärt på gym, hemma eller utomhus. Det är möjligt att välja flera alternativ.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trainingPlaceOptions.map((option) => (
                      <label
                        key={option}
                        className={`flex items-center gap-3 p-4 rounded-2xl border transition ${form.trainingPlaces.includes(option) ? 'border-[#a0c81d] bg-[#a0c81d]/10' : 'border-white/10 hover:border-white/20'}`}
                      >
                        <input
                          type="checkbox"
                          checked={form.trainingPlaces.includes(option)}
                          onChange={() => setForm((prev) => ({ ...prev, trainingPlaces: toggleArrayValue(prev.trainingPlaces, option) }))}
                          className="accent-[#a0c81d]"
                        />
                        <span className="text-sm font-semibold text-slate-200">{option}</span>
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
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-slate-400">Hur många pass per vecka vill du träna?<span className="text-[#a0c81d]">*</span></p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sessionsOptions.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-center gap-3 p-4 rounded-2xl border transition ${form.sessionsPerWeek === option.value ? 'border-[#a0c81d] bg-[#a0c81d]/10' : 'border-white/10 hover:border-white/20'}`}
                      >
                        <input
                          type="radio"
                          name="sessionsPerWeek"
                          value={option.value}
                          checked={form.sessionsPerWeek === option.value}
                          onChange={() => setForm((prev) => ({ ...prev, sessionsPerWeek: option.value }))}
                          className="accent-[#a0c81d]"
                        />
                        <span className="text-sm font-semibold text-slate-200">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  {form.sessionsPerWeek === 'other' && (
                    <input
                      type="text"
                      value={form.sessionsPerWeekOther}
                      onChange={(e) => setForm((prev) => ({ ...prev, sessionsPerWeekOther: e.target.value }))}
                      className={inputClass}
                      placeholder="Ange antal pass per vecka"
                    />
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-white uppercase tracking-wide">Kroppsmått (valfritt)</h2>
              </div>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, showMeasurements: !prev.showMeasurements }))}
                className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300 hover:text-white"
              >
                <Sparkles className="w-4 h-4" /> {form.showMeasurements ? 'Dölj kroppsmått' : 'Fyll i kroppsmått'}
              </button>

              {form.showMeasurements && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Bröst/Rygg</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.chestBack}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, chestBack: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät under armhålorna och över bröst"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Arm (Höger)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.armRight}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, armRight: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid mitten av överarmen"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Arm (Vänster)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.armLeft}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, armLeft: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid mitten av överarmen"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Axlar</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.shoulders}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, shoulders: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät runt om axlarna"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Midja</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.waist}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, waist: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät midjan vid samma riktmärke"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Lår (Höger)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.thighRight}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, thighRight: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid mitten av låret"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Lår (Vänster)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.thighLeft}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, thighLeft: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid mitten av låret"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Vader (Höger)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.calfRight}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, calfRight: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid vadens största punkt"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Vader (Vänster)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.calfLeft}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, calfLeft: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid vadens största punkt"
                    />
                  </div>
                </div>
              )}
            </section>

            {errorMessage && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200 text-sm">
                {errorMessage}
              </div>
            )}

            {status === 'success' && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200 text-sm">
                Tack! Ditt startformulär är inskickat.
              </div>
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full md:w-auto px-8 py-4 rounded-2xl bg-[#a0c81d] text-[#0f172a] font-black uppercase tracking-widest text-sm shadow-xl shadow-[#a0c81d]/20 hover:bg-[#b5e02e] transition flex items-center justify-center gap-2"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Skickar...
                  </>
                ) : (
                  'Skicka in startformulär'
                )}
              </button>
              <Link
                to="/uppfoljning"
                className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white"
              >
                Gå till uppföljning
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export { Start };
