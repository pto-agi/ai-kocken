import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, ClipboardList, Dumbbell, Bike, Zap, Users, Puzzle, Home, Building2, TreePine, Loader2, Sparkles, Target, Flame, HeartPulse, Sprout, TrendingUp, Award, Crown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
// Email notifications for startformulär are handled by DB trigger → Edge Function.
// import { buildStartNotificationBody, sendStartNotification, type StartNotificationBody } from '../utils/startNotification';

type StartFormState = {
  firstName: string;
  lastName: string;
  email: string;
  desiredStartDate: string;
  weightKg: string;
  heightCm: string;
  age: string;
  gender: string;
  focusAreas: string[];
  goalDescription: string;
  injuries: string;
  // Structured fields (new)
  experienceLevel: string;
  injuryAreas: string[];
  dietHistory: string[];
  preferredFoods: string[];
  // Legacy (kept for backward compat)
  trainingExperience: string;
  activityLast6Months: string;
  dietLast6Months: string;
  // Nutrition fields
  dietType: string;
  allergies: string[];
  mealsPerDay: string;
  cookingLevel: string;
  foodPreferences: string;
  activityLevel: string;
  // Training fields
  trainingForms: string[];
  trainingFormsOther: string;
  trainingPlaces: string[];
  trainingPlacesOther: string;
  homeEquipment: string[];
  homeEquipmentOther: string;
  sessionsPerWeek: string;
  sessionsPerWeekOther: string;
  showGoalDetails: boolean;
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
  { value: 'Viktminskning/minskat kroppsfett', label: 'Viktminskning', icon: Target },
  { value: 'Ökad styrka/muskelmassa', label: 'Styrka & Muskler', icon: Flame },
  { value: 'Förbättrad kondition/uthållighet', label: 'Kondition', icon: Bike },
  { value: 'Förbättrad hälsa/välmående', label: 'Hälsa & Välmående', icon: HeartPulse },
];

const trainingFormOptions = [
  { value: 'Styrketräning', label: 'Styrketräning', icon: Dumbbell },
  { value: 'Konditionsträning', label: 'Konditionsträning', icon: Bike },
  { value: 'Cirkelträning/HIIT', label: 'HIIT / Cirkelträning', icon: Zap },
  { value: 'Gruppträning', label: 'Gruppträning', icon: Users },
  { value: 'Annat', label: 'Annat', icon: Puzzle },
];

const trainingPlaceOptions = [
  { value: 'Gym', label: 'Gym', icon: Building2 },
  { value: 'Hemma', label: 'Hemma', icon: Home },
  { value: 'Utomhus', label: 'Utomhus', icon: TreePine },
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

const sessionsOptions = [
  { value: '1', label: '1 pass per vecka' },
  { value: '2', label: '2 pass per vecka' },
  { value: '3', label: '3 pass per vecka' },
  { value: '4', label: '4 pass per vecka' },
  { value: '5', label: '5 pass per vecka' },
  { value: 'none', label: 'Ingen träning' },
  { value: 'other', label: 'Annan' }
];

const genderOptions = ['Man', 'Kvinna', 'Annat'];

const experienceLevelOptions = [
  { value: 'nybörjare', label: 'Nybörjare', desc: 'Ny till styrketräning eller tränat sporadiskt', icon: Sprout },
  { value: 'viss erfarenhet', label: 'Viss erfarenhet', desc: 'Tränat regelbundet 6–18 månader', icon: TrendingUp },
  { value: 'erfaren', label: 'Erfaren', desc: 'Konsekvent träning i 1–3+ år', icon: Award },
  { value: 'avancerad', label: 'Avancerad', desc: '3+ år, van vid tunga lyft och periodisering', icon: Crown },
];

const injuryAreaOptions = ['Rygg', 'Nacke', 'Axlar', 'Knän', 'Höfter', 'Handleder', 'Fötter/anklar', 'Inga'];

const dietHistoryOptions = ['Kaloriräkning', 'Strikt diet', 'Ostrukturerat ätande', 'Periodisk fasta', 'Intuitivt ätande'];

const preferredFoodOptions = ['Kyckling', 'Fisk', 'Nötkött', 'Ägg', 'Bönor & linser', 'Tofu & tempeh', 'Ris', 'Pasta'];

const dietTypeOptions = ['Allätare', 'Vegetarisk', 'Vegan', 'Pescetarian', 'Lakto-ovo vegetarisk'];

const allergyOptions = ['Gluten', 'Laktos', 'Nötter', 'Ägg', 'Soja', 'Fisk', 'Skaldjur'];

const mealsPerDayOptions = [
  { value: '3', label: '3 måltider' },
  { value: '4', label: '4 måltider' },
  { value: '5', label: '5 måltider' },
  { value: '6', label: '6 måltider' },
];

const cookingLevelOptions = [
  { value: 'enkel', label: 'Enkel — snabba, lätta recept' },
  { value: 'medel', label: 'Medel — varierad matlagning' },
  { value: 'avancerad', label: 'Avancerad — gillar att laga mat' },
];

const activityLevelOptions = [
  { value: 'stillasittande', label: 'Stillasittande (kontorsjobb, lite rörelse)' },
  { value: 'lätt aktiv', label: 'Lätt aktiv (promenader, stående jobb)' },
  { value: 'måttligt aktiv', label: 'Måttligt aktiv (regelbunden motion)' },
  { value: 'mycket aktiv', label: 'Mycket aktiv (hård träning/fysiskt jobb)' },
];

const emptyState: StartFormState = {
  firstName: '',
  lastName: '',
  email: '',
  desiredStartDate: '',
  weightKg: '',
  heightCm: '',
  age: '',
  gender: '',
  focusAreas: [],
  goalDescription: '',
  injuries: '',
  experienceLevel: '',
  injuryAreas: [],
  dietHistory: [],
  preferredFoods: [],
  trainingExperience: '',
  activityLast6Months: '',
  dietLast6Months: '',
  dietType: '',
  allergies: [],
  mealsPerDay: '4',
  cookingLevel: '',
  foodPreferences: '',
  activityLevel: '',
  trainingForms: [],
  trainingFormsOther: '',
  trainingPlaces: [],
  trainingPlacesOther: '',
  homeEquipment: [],
  homeEquipmentOther: '',
  sessionsPerWeek: '',
  sessionsPerWeekOther: '',
  showGoalDetails: false,
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

const inputClass = 'w-full p-3 rounded-xl bg-[#F6F1E7]/70 border border-[#E6E1D8] text-[#3D3D3D] placeholder:text-[#8A8177] focus:border-[#a0c81d] focus:ring-0 outline-none transition';
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

type StartSubmitStatus = 'idle' | 'submitting' | 'resending_notification' | 'success' | 'error' | 'notification_error';

const Start: React.FC = () => {
  const { session, profile } = useAuthStore();
  const [form, setForm] = useState<StartFormState>(emptyState);
  const [status, setStatus] = useState<StartSubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [hasInjuries, setHasInjuries] = useState<boolean | null>(null);
  // Pending notification body removed — DB trigger handles email automatically
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

  const requiredFields = useMemo(() => {
    const checks = [
      { label: 'Förnamn och efternamn', done: Boolean(form.firstName.trim() && form.lastName.trim()) },
      { label: 'E-post', done: Boolean(form.email.trim()) },
      { label: 'Vikt', done: Boolean(form.weightKg.trim()) },
      { label: 'Längd', done: Boolean(form.heightCm.trim()) },
      { label: 'Ålder', done: Boolean(form.age.trim()) },
      { label: 'Fokusområden', done: form.focusAreas.length > 0 },
      { label: 'Träningserfarenhet', done: Boolean(form.experienceLevel) },
      { label: 'Pass per vecka', done: Boolean(form.sessionsPerWeek) },
    ];

    if (form.sessionsPerWeek === 'other') {
      checks.push({
        label: 'Antal pass per vecka',
        done: Boolean(form.sessionsPerWeekOther.trim()),
      });
    }

    return checks;
  }, [
    form.age,
    form.email,
    form.experienceLevel,
    form.firstName,
    form.focusAreas.length,
    form.heightCm,
    form.lastName,
    form.sessionsPerWeek,
    form.sessionsPerWeekOther,
    form.weightKg,
  ]);

  const completedRequiredCount = requiredFields.filter((item) => item.done).length;
  const requiredProgress = requiredFields.length === 0
    ? 0
    : Math.round((completedRequiredCount / requiredFields.length) * 100);
  const missingRequiredLabels = requiredFields
    .filter((item) => !item.done)
    .map((item) => item.label);

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
    if (!form.experienceLevel) {
      return 'Välj din träningserfarenhet.';
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
    setNotificationMessage(null);

    // Email notification retry removed — DB trigger on startformular handles email automatically.
    // If form is already saved, just navigate to thank-you page.

    if (!isConfigured) {
      setErrorMessage('Supabase är inte konfigurerat. Kontrollera VITE_SUPABASE_URL och VITE_SUPABASE_ANON_KEY.');
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
      user_id: session?.user?.id ?? null,
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
      // Structured fields
      experience_level: form.experienceLevel || null,
      injury_areas: form.injuryAreas.length > 0 ? form.injuryAreas : null,
      diet_history: form.dietHistory.length > 0 ? form.dietHistory : null,
      preferred_foods: form.preferredFoods.length > 0 ? form.preferredFoods : null,
      // Legacy fields (still populated for backward compat)
      training_experience: form.trainingExperience.trim() || null,
      activity_last_6_months: form.activityLast6Months.trim() || null,
      diet_last_6_months: form.dietLast6Months.trim() || null,
      training_forms: form.trainingForms,
      training_forms_other: form.trainingForms.includes('Annat') ? (form.trainingFormsOther.trim() || null) : null,
      training_places: form.trainingPlaces,
      training_places_other: form.trainingPlaces.includes('Annat') ? (form.trainingPlacesOther.trim() || null) : null,
      home_equipment: form.trainingPlaces.includes('Hemma') ? form.homeEquipment : [],
      home_equipment_other: form.trainingPlaces.includes('Hemma') ? (form.homeEquipmentOther.trim() || null) : null,
      sessions_per_week: sessionsLabel,
      sessions_per_week_other: form.sessionsPerWeek === 'other' ? (form.sessionsPerWeekOther.trim() || null) : null,
      // Nutrition fields
      gender: form.gender || null,
      diet_type: form.dietType || null,
      allergies: form.allergies.length > 0 ? form.allergies : null,
      meals_per_day: form.mealsPerDay ? parseInt(form.mealsPerDay) : null,
      cooking_level: form.cookingLevel || null,
      food_preferences: form.foodPreferences.trim() || null,
      activity_level: form.activityLevel || null,
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

    // Email notification is handled automatically by DB trigger on the startformular table.
    // Do NOT call email-trigger directly from the frontend — it causes duplicate emails.
    console.debug('Startformulär submitted — email handled by DB trigger → AntiGravity Agent');

    setStatus('success');
    navigate('/start/tack');
  };

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#3D3D3D] font-sans pb-24 md:pb-32 pt-12 sm:pt-14 md:pt-24 px-3 sm:px-4 overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="max-w-5xl mx-auto relative z-10 animate-fade-in">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-5 md:mb-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/40 flex items-center justify-center text-[#a0c81d]">
                <ClipboardList className="w-6 h-6" />
              </div>
              <span className="text-xs font-black uppercase tracking-[0.3em] text-[#8A8177]">Startformulär</span>
            </div>
            <h1 className="text-[30px] leading-tight md:text-4xl font-black text-[#3D3D3D] tracking-tight">Nu är det dags att inleda planeringsarbetet</h1>
            <p className="text-[#6B6158] mt-3 text-[15px] leading-6 max-w-2xl">Fyll i uppgifter kring mål, träningserfarenheter, skador och annan information som ligger till grund för din planering.</p>
            <p className="mt-3 text-xs font-bold uppercase tracking-widest text-[#8A8177]">Fält markerade med <span className="text-[#a0c81d]">*</span> är obligatoriska.</p>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-[#DAD1C5] bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#6B6158]">Obligatoriska fält</p>
            <span className="text-sm font-black text-[#3D3D3D]">{completedRequiredCount}/{requiredFields.length}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#E6E1D8] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#a0c81d] transition-all duration-300"
              style={{ width: `${requiredProgress}%` }}
            />
          </div>
          {missingRequiredLabels.length > 0 && (
            <p className="mt-2 text-xs text-[#6B6158]">
              Kvar att fylla i: {missingRequiredLabels.slice(0, 3).join(', ')}
              {missingRequiredLabels.length > 3 ? ' ...' : ''}
            </p>
          )}
        </div>

        {!session?.user?.id ? (
          <div className="mb-4 rounded-2xl border border-[#DAD1C5] bg-white/90 p-4 sm:p-5 shadow-sm">
            <p className="text-sm text-[#6B6158]">
              Du kan skicka in formuläret direkt utan konto, eller skapa konto först för att koppla inlämningen till din profil.
            </p>
            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-[#a0c81d]/40 bg-[#E8F1D5] px-3 py-1 text-[11px] font-black uppercase tracking-widest text-[#5C7A12]">
                Lämna in som gäst
              </span>
              <Link
                to="/auth"
                className="inline-flex items-center rounded-xl border border-[#DAD1C5] bg-[#F6F1E7] px-4 py-2 text-[11px] font-black uppercase tracking-widest text-[#3D3D3D] hover:border-[#a0c81d]/40 hover:text-[#5C7A12] transition"
              >
                Skapa konto och spara dina uppgifter
              </Link>
            </div>
            <p className="mt-3 text-xs text-[#8A8177]">Vid uppföljning behöver du vara inloggad.</p>
          </div>
        ) : (
          <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-50 p-4 text-sm text-emerald-900">
            Inloggad: din startinlämning kopplas automatiskt till ditt konto.
          </div>
        )}

        <div className="bg-white/90 backdrop-blur-xl rounded-[1.75rem] md:rounded-[2.5rem] p-4 sm:p-6 md:p-10 border border-[#E6E1D8] shadow-2xl overflow-hidden">
          {!isConfigured && (
            <div className="mb-8 rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-amber-900 text-sm" role="alert" aria-live="polite">
              Supabase är inte konfigurerat ännu. Lägg in dina nycklar i <code className="text-amber-950">.env.local</code> för att kunna skicka formulär.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8 md:space-y-12">
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-[#3D3D3D] uppercase tracking-wide">Kontaktuppgifter</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="start-first-name" className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Förnamn<span className="text-[#a0c81d]">*</span></label>
                  <input
                    id="start-first-name"
                    type="text"
                    required
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    className={inputClass}
                    placeholder="Förnamn"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="start-last-name" className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Efternamn<span className="text-[#a0c81d]">*</span></label>
                  <input
                    id="start-last-name"
                    type="text"
                    required
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={(e) => setForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    className={inputClass}
                    placeholder="Efternamn"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="start-email" className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">E-post<span className="text-[#a0c81d]">*</span></label>
                <input
                  id="start-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className={inputClass}
                  placeholder="Din e-postadress"
                />
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-[#3D3D3D] uppercase tracking-wide">Grunddata</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label htmlFor="start-weight" className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Kroppsvikt (kg)<span className="text-[#a0c81d]">*</span></label>
                  <input
                    id="start-weight"
                    type="number"
                    required
                    min={30}
                    max={300}
                    step="0.1"
                    inputMode="decimal"
                    value={form.weightKg}
                    onChange={(e) => setForm((prev) => ({ ...prev, weightKg: e.target.value }))}
                    className={inputClass}
                    placeholder="Vikt"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="start-height" className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Längd (cm)<span className="text-[#a0c81d]">*</span></label>
                  <input
                    id="start-height"
                    type="number"
                    required
                    min={100}
                    max={250}
                    inputMode="decimal"
                    value={form.heightCm}
                    onChange={(e) => setForm((prev) => ({ ...prev, heightCm: e.target.value }))}
                    className={inputClass}
                    placeholder="Längd"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="start-age" className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Ålder<span className="text-[#a0c81d]">*</span></label>
                  <input
                    id="start-age"
                    type="number"
                    required
                    min={10}
                    max={120}
                    step={1}
                    inputMode="numeric"
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
                <h2 className="text-xl font-black text-[#3D3D3D] uppercase tracking-wide">Mål & bakgrund</h2>
              </div>
              <div className="space-y-5">
                {/* Huvudmål — icon cards */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Välj dina huvudmål<span className="text-[#a0c81d]">*</span></label>
                  <p className="text-sm text-[#6B6158]">Vad vill du fokusera på? Välj ett eller flera alternativ.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {focusOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = form.focusAreas.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, focusAreas: toggleArrayValue(prev.focusAreas, opt.value) }))}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition ${
                            isSelected
                              ? 'border-[#a0c81d] bg-[#a0c81d]/10 shadow-sm'
                              : 'border-[#E6E1D8] hover:border-[#a0c81d]/40 bg-white'
                          }`}
                        >
                          <Icon className={`w-7 h-7 transition ${isSelected ? 'text-[#a0c81d]' : 'text-[#8A8177]'}`} />
                          <span className={`text-xs font-bold text-center leading-tight transition ${isSelected ? 'text-[#3D3D3D]' : 'text-[#6B6158]'}`}>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Träningserfarenhet — icon cards */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Träningserfarenhet<span className="text-[#a0c81d]">*</span></label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {experienceLevelOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = form.experienceLevel === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, experienceLevel: opt.value }))}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-center transition ${
                            isSelected
                              ? 'border-[#a0c81d] bg-[#a0c81d]/10 shadow-sm'
                              : 'border-[#E6E1D8] hover:border-[#a0c81d]/40 bg-white'
                          }`}
                        >
                          <Icon className={`w-7 h-7 transition ${isSelected ? 'text-[#a0c81d]' : 'text-[#8A8177]'}`} />
                          <span className={`text-sm font-bold leading-tight transition ${isSelected ? 'text-[#3D3D3D]' : 'text-[#6B6158]'}`}>{opt.label}</span>
                          <span className={`text-[11px] leading-tight transition ${isSelected ? 'text-[#3D3D3D]' : 'text-[#8A8177]'}`}>{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Eventuella skador — Ja/Nej toggle → expanderar vid Ja */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Har du några skador eller begränsningar?</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setHasInjuries(true);
                        setForm((prev) => ({
                          ...prev,
                          injuryAreas: prev.injuryAreas.includes('Inga') ? [] : prev.injuryAreas,
                        }));
                      }}
                      className={`flex-1 py-3 rounded-2xl border text-sm font-semibold transition ${
                        hasInjuries === true
                          ? 'border-[#a0c81d] bg-[#a0c81d]/10 text-[#3D3D3D]'
                          : 'border-[#E6E1D8] text-[#6B6158] hover:border-[#ccc]'
                      }`}
                    >
                      Ja
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHasInjuries(false);
                        setForm((prev) => ({ ...prev, injuryAreas: ['Inga'], injuries: '' }));
                      }}
                      className={`flex-1 py-3 rounded-2xl border text-sm font-semibold transition ${
                        hasInjuries === false
                          ? 'border-[#a0c81d] bg-[#a0c81d]/10 text-[#3D3D3D]'
                          : 'border-[#E6E1D8] text-[#6B6158] hover:border-[#ccc]'
                      }`}
                    >
                      Nej
                    </button>
                  </div>

                  {/* Description field — only visible when "Ja" */}
                  {hasInjuries === true && (
                    <input
                      type="text"
                      value={form.injuries}
                      onChange={(e) => setForm((prev) => ({ ...prev, injuries: e.target.value }))}
                      className={inputClass}
                      placeholder="Beskriv dina skador eller begränsningar"
                    />
                  )}
                </div>

                {/* Målbeskrivning — collapsible */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, showGoalDetails: !prev.showGoalDetails }))}
                    className="flex items-center justify-between w-full text-left group"
                  >
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158] cursor-pointer group-hover:text-[#3D3D3D] transition">Övriga detaljer kring dina mål (valfritt)</label>
                    {form.showGoalDetails ? <ChevronUp className="w-4 h-4 text-[#8A8177]" /> : <ChevronDown className="w-4 h-4 text-[#8A8177]" />}
                  </button>
                  {form.showGoalDetails && (
                    <textarea
                      value={form.goalDescription}
                      onChange={(e) => setForm((prev) => ({ ...prev, goalDescription: e.target.value }))}
                      className={`${inputClass} min-h-[120px]`}
                      rows={4}
                      placeholder="Beskriv specifika mål, tidsmål eller annan info som kan vara relevant för din planering."
                    />
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-[#3D3D3D] uppercase tracking-wide">Träningsupplägg</h2>
              </div>
              <div className="space-y-6">
                {/* Träningsformer — icon cards */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Träningsformer<span className="text-[#a0c81d]">*</span></label>
                  <p className="text-sm text-[#6B6158]">Välj de träningsformer du vill ha i ditt upplägg.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {trainingFormOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = form.trainingForms.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, trainingForms: toggleArrayValue(prev.trainingForms, opt.value) }))}
                          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition ${
                            isSelected
                              ? 'border-[#a0c81d] bg-[#a0c81d]/10 shadow-sm'
                              : 'border-[#E6E1D8] hover:border-[#a0c81d]/40 bg-white'
                          }`}
                        >
                          <Icon className={`w-7 h-7 transition ${isSelected ? 'text-[#a0c81d]' : 'text-[#8A8177]'}`} />
                          <span className={`text-xs font-bold text-center leading-tight transition ${isSelected ? 'text-[#3D3D3D]' : 'text-[#6B6158]'}`}>{opt.label}</span>
                        </button>
                      );
                    })}
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

                {/* Träningsplats — icon cards */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Var vill du träna?</label>
                  <div className="grid grid-cols-3 gap-3">
                    {trainingPlaceOptions.map((opt) => {
                      const Icon = opt.icon;
                      const isSelected = form.trainingPlaces.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, trainingPlaces: toggleArrayValue(prev.trainingPlaces, opt.value) }))}
                          className={`flex flex-col items-center gap-2 py-5 px-3 rounded-2xl border-2 transition ${
                            isSelected
                              ? 'border-[#a0c81d] bg-[#a0c81d]/10 shadow-sm'
                              : 'border-[#E6E1D8] hover:border-[#a0c81d]/40 bg-white'
                          }`}
                        >
                          <Icon className={`w-8 h-8 transition ${isSelected ? 'text-[#a0c81d]' : 'text-[#8A8177]'}`} />
                          <span className={`text-sm font-bold transition ${isSelected ? 'text-[#3D3D3D]' : 'text-[#6B6158]'}`}>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {form.trainingPlaces.includes('Hemma') && (
                    <div className="mt-3 space-y-3">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Utrustning hemma</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {homeEquipmentOptions.map((option) => (
                          <label
                            key={option}
                            className={`flex items-center gap-2 p-3 rounded-2xl border transition cursor-pointer ${
                              form.homeEquipment.includes(option) ? 'border-[#a0c81d] bg-[#a0c81d]/10' : 'border-[#E6E1D8] hover:border-[#E6E1D8]'
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label htmlFor="start-sessions" className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">
                      Antal pass per vecka<span className="text-[#a0c81d]">*</span>
                    </label>
                    <select
                      id="start-sessions"
                      value={form.sessionsPerWeek}
                      onChange={(e) => setForm((prev) => ({ ...prev, sessionsPerWeek: e.target.value }))}
                      className={inputClass}
                      required
                    >
                      <option value="">Välj antal</option>
                      {sessionsOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {form.sessionsPerWeek === 'other' && (
                      <input
                        id="start-sessions-other"
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        value={form.sessionsPerWeekOther}
                        onChange={(e) => setForm((prev) => ({ ...prev, sessionsPerWeekOther: e.target.value }))}
                        className={inputClass}
                        placeholder="Ange antal pass per vecka"
                      />
                    )}
                  </div>
                  <div className="space-y-3">
                    <label htmlFor="start-date" className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Önskat startdatum</label>
                    <input
                      id="start-date"
                      type="date"
                      value={form.desiredStartDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, desiredStartDate: e.target.value }))}
                      className={`${inputClass} max-w-full`}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-[#3D3D3D] uppercase tracking-wide">Kostpreferenser</h2>
              </div>
              <div className="space-y-5">
                {/* Kosthistorik — multi-select chips */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Kosthistorik (hur du ätit senaste tiden)</label>
                  <div className="flex gap-2 flex-wrap">
                    {dietHistoryOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wide border transition ${
                          form.dietHistory.includes(opt)
                            ? 'bg-[#a0c81d] text-white border-[#a0c81d]'
                            : 'bg-white text-[#3D3D3D] border-[#DAD1C5] hover:border-[#a0c81d]'
                        }`}
                        onClick={() => setForm((prev) => ({ ...prev, dietHistory: toggleArrayValue(prev.dietHistory, opt) }))}
                      >{opt}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Kön</label>
                    <div className="flex gap-2 flex-wrap">
                      {genderOptions.map((g) => (
                        <button key={g} type="button"
                          className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wide border transition ${form.gender === g ? 'bg-[#a0c81d] text-white border-[#a0c81d]' : 'bg-white text-[#3D3D3D] border-[#DAD1C5] hover:border-[#a0c81d]'}`}
                          onClick={() => setForm((prev) => ({ ...prev, gender: g }))}
                        >{g}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Aktivitetsnivå</label>
                    <select
                      value={form.activityLevel}
                      onChange={(e) => setForm((prev) => ({ ...prev, activityLevel: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Välj aktivitetsnivå</option>
                      {activityLevelOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Kosthållning</label>
                    <select
                      value={form.dietType}
                      onChange={(e) => setForm((prev) => ({ ...prev, dietType: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Välj kosthållning</option>
                      {dietTypeOptions.map((d) => (
                        <option key={d} value={d.toLowerCase()}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Antal måltider per dag</label>
                    <div className="flex gap-2 flex-wrap">
                      {mealsPerDayOptions.map((o) => (
                        <button key={o.value} type="button"
                          className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wide border transition ${form.mealsPerDay === o.value ? 'bg-[#a0c81d] text-white border-[#a0c81d]' : 'bg-white text-[#3D3D3D] border-[#DAD1C5] hover:border-[#a0c81d]'}`}
                          onClick={() => setForm((prev) => ({ ...prev, mealsPerDay: o.value }))}
                        >{o.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Allergier &amp; intoleranser</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {allergyOptions.map((a) => (
                      <label key={a} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.allergies.includes(a.toLowerCase())}
                          onChange={() => {
                            setForm((prev) => ({
                              ...prev,
                              allergies: prev.allergies.includes(a.toLowerCase())
                                ? prev.allergies.filter((x) => x !== a.toLowerCase())
                                : [...prev.allergies, a.toLowerCase()]
                            }));
                          }}
                          className="rounded border-[#E6E1D8] text-[#a0c81d] focus:ring-[#a0c81d]"
                        />
                        <span className="text-sm text-[#3D3D3D]">{a}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Matlagningsnivå</label>
                    <select
                      value={form.cookingLevel}
                      onChange={(e) => setForm((prev) => ({ ...prev, cookingLevel: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">Välj nivå</option>
                      {cookingLevelOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Matpreferenser</label>
                    <div className="flex gap-2 flex-wrap mb-2">
                      {preferredFoodOptions.map((food) => (
                        <button
                          key={food}
                          type="button"
                          className={`px-3 py-1.5 rounded-xl text-sm font-bold uppercase tracking-wide border transition ${
                            form.preferredFoods.includes(food)
                              ? 'bg-[#a0c81d] text-white border-[#a0c81d]'
                              : 'bg-white text-[#3D3D3D] border-[#DAD1C5] hover:border-[#a0c81d]'
                          }`}
                          onClick={() => setForm((prev) => ({ ...prev, preferredFoods: toggleArrayValue(prev.preferredFoods, food) }))}
                        >{food}</button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={form.foodPreferences}
                      onChange={(e) => setForm((prev) => ({ ...prev, foodPreferences: e.target.value }))}
                      className={inputClass}
                      placeholder="Annat, t.ex. ogillar svamp..."
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-2 h-6 bg-[#a0c81d] rounded-full"></div>
                <h2 className="text-xl font-black text-[#3D3D3D] uppercase tracking-wide">Kroppsmått (valfritt)</h2>
              </div>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, showMeasurements: !prev.showMeasurements }))}
                className="w-full md:w-auto inline-flex items-center justify-between gap-2 text-xs font-black uppercase tracking-widest text-[#6B6158] hover:text-[#3D3D3D]"
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {form.showMeasurements ? 'Dölj kroppsmått' : 'Fyll i kroppsmått'}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${form.showMeasurements ? 'rotate-180' : ''}`} />
              </button>

              {form.showMeasurements && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Bröst/Rygg</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.chestBack}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, chestBack: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät under armhålorna och över bröst"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Arm (Höger)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.armRight}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, armRight: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid mitten av överarmen"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Arm (Vänster)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.armLeft}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, armLeft: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid mitten av överarmen"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Axlar</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.shoulders}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, shoulders: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät runt om axlarna"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Midja</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.waist}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, waist: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät midjan vid samma riktmärke"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Lår (Höger)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.thighRight}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, thighRight: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid mitten av låret"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Lår (Vänster)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.thighLeft}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, thighLeft: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid mitten av låret"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Vader (Höger)</label>
                    <input
                      type="number"
                      value={form.bodyMeasurements.calfRight}
                      onChange={(e) => setForm((prev) => ({ ...prev, bodyMeasurements: { ...prev.bodyMeasurements, calfRight: e.target.value } }))}
                      className={inputClass}
                      placeholder="Mät vid vadens största punkt"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-[#6B6158]">Vader (Vänster)</label>
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
              <div className="rounded-2xl border border-red-500/40 bg-red-50 p-4 text-red-900 text-sm" role="alert" aria-live="assertive">
                {errorMessage}
              </div>
            )}

            {notificationMessage && (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-4 text-amber-900 text-sm" role="alert" aria-live="polite">
                {notificationMessage}
              </div>
            )}

            {status === 'success' && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-50 p-4 text-emerald-900 text-sm" role="status" aria-live="polite">
                Tack! Ditt startformulär är inskickat.
              </div>
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <button
                type="submit"
                disabled={status === 'submitting' || status === 'resending_notification'}
                className="w-full md:w-auto px-8 py-4 rounded-2xl bg-[#a0c81d] text-[#F6F1E7] font-black uppercase tracking-widest text-sm shadow-xl shadow-[#a0c81d]/20 hover:bg-[#5C7A12] transition flex items-center justify-center gap-2"
              >
                {status === 'submitting' || status === 'resending_notification' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Skickar...
                  </>
                ) : (
                  'Skicka in startformulär'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export { Start };
