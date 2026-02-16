import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ChefHat, Sparkles, Loader2, CalendarDays, ArrowLeft,
  ArrowRight, Heart,
  Zap, Flame, Activity,
  CheckCircle2, Utensils,
  Soup, Carrot, Fish, Beef, Lock, Coffee, Sun, Moon, Apple, Brain,
  Clock, MinusCircle, ChevronDown, ChevronUp, Egg, Leaf, Weight, LifeBuoy
} from 'lucide-react';
import { generateRecipeIdeas, generateRecipe } from '../services/geminiService';
import { RecipeCard } from '../components/RecipeCard';
import ReactMarkdown from 'react-markdown';
import { RecipeIdea, SavedRecipe, ViewState, SmartRecipeData } from '../types';
import { databaseService } from '../services/databaseService';
import WeeklyPlanner from './WeeklyPlanner';
import SupportChat from './SupportChat';
import { useAuthStore } from '../store/authStore';
import { useRecipeStore } from '../store/recipeStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';

type MainTab = 'RECIPES' | 'WEEKLY' | 'SUPPORT';
type MealType = 'Frukost' | 'Lunch' | 'Middag' | 'Mellanmål' | 'Alla';

// Minimal, robust ikon-typ för lucide components
type IconType = React.ComponentType<{ className?: string }>;

interface RecipeBankProps {
  onNavigate?: (view: ViewState) => void;
  isPremium: boolean;
  isAuthenticated: boolean;
}

const LOADING_STATES: { text: string; icon: IconType }[] = [
  { text: "PTO Ai analyserar smakprofiler...", icon: Brain },
  { text: "Kalibrerar makronutrienter...", icon: Activity },
  { text: "Konsulterar Michelin-guiden...", icon: Sparkles },
  { text: "Hackar färska örter...", icon: Utensils },
  { text: "Värmer upp stekpannan...", icon: Flame },
  { text: "PTO Ai smakar av såsen...", icon: Soup },
  { text: "Optimerar för maximal energi...", icon: Zap },
  { text: "Lägger upp på tallriken...", icon: ChefHat }
];

const MEAL_TYPES: { id: MealType; label: string; icon: IconType }[] = [
  { id: 'Frukost', label: 'Frukost', icon: Coffee },
  { id: 'Lunch', label: 'Lunch', icon: Sun },
  { id: 'Mellanmål', label: 'Mellanmål', icon: Apple },
  { id: 'Middag', label: 'Middag', icon: Moon },
];

const STYLE_PREFS = [
  { id: 'Husmanskost', label: 'Husmanskost' },
  { id: 'Vegetariskt', label: 'Vegetariskt' },
  { id: 'Snabbt & Enkelt', label: 'Snabbt & Enkelt' },
  { id: 'Budget', label: 'Budget' },
  { id: 'Asiatiskt', label: 'Asiatiskt' },
  { id: 'Italienskt', label: 'Italienskt' }
];

const NUTRITION_PREFS = [
  { id: 'Proteinrikt', label: 'Proteinrikt' },
  { id: 'Kalorisnålt', label: 'Kalorisnålt' },
  { id: 'Lågkolhydrat', label: 'Lågkolhydrat' },
  { id: 'Keto', label: 'Keto' },
  { id: 'Glutenfritt', label: 'Glutenfritt' }
];

const TIME_PREFS: { id: string; label: string; icon: IconType }[] = [
  { id: '15min', label: 'Snabb (15 min)', icon: Zap },
  { id: '30min', label: 'Medium (30 min)', icon: Clock },
  { id: '60min', label: 'Långsam (60+ min)', icon: Flame },
];

const PROTEIN_PREFS: { id: string; label: string; icon: IconType }[] = [
  { id: 'Kyckling', label: 'Kyckling', icon: Utensils },
  { id: 'Nötkött', label: 'Nötkött', icon: Beef },
  { id: 'Fisk', label: 'Fisk', icon: Fish },
  { id: 'Växtbaserat', label: 'Växtbaserat', icon: Carrot },
  { id: 'Ägg', label: 'Ägg', icon: Egg },
];

const STRIPE_LINK = 'https://betalning.privatetrainingonline.se/b/cNi00i4bN9lBaqO4sDcfK0v?locale=sv';

function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1023px)').matches;
}

function parseCommaList(input: string, maxItems = 25) {
  return (input || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

type IdeaLike = RecipeIdea & Partial<{
  name: string;
  beskrivning: string;
  proteinGrams: number;
}>;

function normalizeIdea(idea: IdeaLike) {
  const title = idea.title ?? idea.name ?? "Nytt Recept";
  const description = idea.description ?? idea.beskrivning ?? "Klicka för att se detaljer.";
  const calories = typeof idea.calories === 'number' ? idea.calories : null;

  const proteinGrams =
    typeof idea.proteinGrams === 'number'
      ? idea.proteinGrams
      : (calories ? Math.round((calories * 0.35) / 4) : null);

  const tags = Array.isArray(idea.tags) ? idea.tags : [];

  return { title, description, calories, proteinGrams, tags };
}

function safeTabFromUrl(v: string | null): MainTab {
  if (v === 'RECIPES') return 'RECIPES';
  if (v === 'WEEKLY') return 'WEEKLY';
  if (v === 'SUPPORT') return 'SUPPORT';
  return 'WEEKLY';
}

function safeSubTabFromUrl(v: string | null): 'GENERATOR' | 'LIBRARY' {
  if (v === 'LIBRARY') return 'LIBRARY';
  if (v === 'GENERATOR') return 'GENERATOR';
  return 'GENERATOR';
}

const RecipeBank: React.FC<RecipeBankProps> = ({ onNavigate: _onNavigate, isPremium, isAuthenticated }) => {
  const { session } = useAuthStore();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    ideas, isGenerating, isWritingRecipe, generatedRecipeContent, selectedIdea,
    error, preferences, setIdeas, setGenerating, setWriting, setGeneratedRecipeContent,
    setSelectedIdea, setError, updatePreferences
  } = useRecipeStore();

  const [smartRecipe, setSmartRecipe] = useState<SmartRecipeData | null>(null);

  // default och URL-tab
  const [mainTab, setMainTab] = useState<MainTab>(() => safeTabFromUrl(searchParams.get('tab')));
  const [activeSubTab, setActiveSubTab] = useState<'GENERATOR' | 'LIBRARY'>(() =>
    safeSubTabFromUrl(searchParams.get('subTab'))
  );

  const [selectedMealType, setSelectedMealType] = useState<MealType>('Alla');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedProtein, setSelectedProtein] = useState<string[]>([]);
  const [excludeIngredients, setExcludeIngredients] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [magicRequest, setMagicRequest] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedSavedRecipe, setSelectedSavedRecipe] = useState<SavedRecipe | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);
  const [loadingStateIndex, setLoadingStateIndex] = useState(0);

  // Request-id för att undvika stale responses (race conditions)
  const reqIdRef = useRef(0);

  // Determine if we are currently viewing a recipe (active state)
  const isViewingRecipe = useMemo(() =>
    !!(smartRecipe || selectedSavedRecipe || generatedRecipeContent),
    [smartRecipe, selectedSavedRecipe, generatedRecipeContent]
  );

  const searchString = useMemo(() => searchParams.toString(), [searchParams]);

  // Synca tabs till URL (minimalt men väldigt praktiskt)
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', mainTab);
    next.set('subTab', activeSubTab);

    const nextString = next.toString();
    if (nextString !== searchString) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, activeSubTab, setSearchParams, searchString]);

  // Loading state cycling
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    if (isGenerating || isWritingRecipe) {
      setLoadingStateIndex(0);
      intervalId = setInterval(() => {
        setLoadingStateIndex(prev => (prev + 1) % LOADING_STATES.length);
      }, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isGenerating, isWritingRecipe]);

  const scrollToResultsOnMobile = useCallback(() => {
    if (!isMobileViewport()) return;
    // requestAnimationFrame ger ofta “snällare” scroll än setTimeout
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const ensureAuthenticated = useCallback((message: string) => {
    if (isAuthenticated) return true;
    if (window.confirm(message)) navigate('/auth');
    return false;
  }, [isAuthenticated, navigate]);

  const ensurePremium = useCallback((message: string) => {
    if (isPremium) return true;
    if (window.confirm(message)) window.location.href = STRIPE_LINK;
    return false;
  }, [isPremium]);

  const { data: savedRecipes = [] } = useQuery<SavedRecipe[]>({
    queryKey: ['savedRecipes', userId],
    queryFn: () => userId ? databaseService.getSavedRecipes(userId) : Promise.resolve([] as SavedRecipe[]),
    enabled: !!userId && activeSubTab === 'LIBRARY',
  });

  const saveRecipeMutation = useMutation({
    mutationFn: async (variables: { title: string; content: string; tags: string[] }) => {
      if (!userId) throw new Error("Inloggning krävs");

      return databaseService.saveRecipe({
        user_id: userId,
        title: variables.title,
        instructions: variables.content,
        tags: variables.tags,
        ingredients: [],
        macros: {},
        content: variables.content
      });
    },
    onSuccess: () => {
      // Invalidiera exakt queryKey (så att det funkar även med userId i key)
      queryClient.invalidateQueries({ queryKey: ['savedRecipes', userId] });
      setShowSaveSuccess(true);
      setTimeout(() => setShowSaveSuccess(false), 3000);
    }
  });

  const filteredSavedRecipes = useMemo(() => {
    const search = (librarySearch || "").toLowerCase();
    return savedRecipes.filter(r =>
      (r.title || "").toLowerCase().includes(search) ||
      r.tags?.some(t => (t || "").toLowerCase().includes(search))
    );
  }, [savedRecipes, librarySearch]);

  const togglePreference = (type: 'styles' | 'nutrition', pref: string) => {
    const current = preferences[type];
    const updated = current.includes(pref) ? current.filter(p => p !== pref) : [...current, pref];
    updatePreferences({ [type]: updated });
  };

  const toggleProtein = (prot: string) => {
    setSelectedProtein(prev => prev.includes(prot) ? prev.filter(p => p !== prot) : [...prev, prot]);
  };

  const buildTags = useCallback(() => {
    const tags: string[] = [...preferences.styles, ...preferences.nutrition];

    if (selectedMealType !== 'Alla') tags.push(`Måltid: ${selectedMealType}`);
    if (selectedTime) tags.push(`Max tid: ${selectedTime}`);
    if (selectedProtein.length > 0) tags.push(`Protein: ${selectedProtein.join(', ')}`);

    const excludeList = parseCommaList(excludeIngredients, 25);
    if (excludeList.length > 0) tags.push(`Uteslut strikt: ${excludeList.join(', ')}`);

    const magic = (magicRequest || '').trim();
    if (magic) tags.push(`Extra önskemål: "${magic}"`);

    return { tags };
  }, [
    preferences.styles,
    preferences.nutrition,
    selectedMealType,
    selectedTime,
    selectedProtein,
    excludeIngredients,
    magicRequest
  ]);

  const handleGetIdeas = async () => {
    const reqId = ++reqIdRef.current;

    setGenerating(true);
    setIdeas([]);
    setGeneratedRecipeContent(null);
    setSmartRecipe(null);
    setSelectedSavedRecipe(null);
    setError(null);

    scrollToResultsOnMobile();

    try {
      const { tags } = buildTags();
      const nextIdeas = await generateRecipeIdeas(tags, '');

      if (reqIdRef.current !== reqId) return; // stale response

      setIdeas(nextIdeas || []);
    } catch (err) {
      if (reqIdRef.current !== reqId) return;
      setError("Kunde inte generera recept just nu.");
    } finally {
      if (reqIdRef.current === reqId) setGenerating(false);
    }
  };

  const handleSelectIdea = async (idea: RecipeIdea) => {
    if (isWritingRecipe) return;

    const reqId = ++reqIdRef.current;

    const meta = normalizeIdea(idea as IdeaLike);

    setSelectedIdea(idea);
    setGeneratedRecipeContent(null);
    setSmartRecipe(null);
    setSelectedSavedRecipe(null);
    setWriting(true);
    setError(null);

    scrollToResultsOnMobile();

    try {
      const { tags } = buildTags();
      const result = await generateRecipe(meta.title, meta.description, tags);

      if (reqIdRef.current !== reqId) return; // stale response

      setGeneratedRecipeContent(typeof result === 'string' ? result : (result as any));
    } catch (err) {
      if (reqIdRef.current !== reqId) return;
      setError("Kunde inte skapa receptet.");
    } finally {
      if (reqIdRef.current === reqId) setWriting(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!ensureAuthenticated("Du behöver ett konto för att spara recept. Vill du skapa ett gratis konto?")) return;
    if (!ensurePremium("Lås upp Premium för att spara recept?")) return;

    if (generatedRecipeContent && selectedIdea) {
      const meta = normalizeIdea(selectedIdea as IdeaLike);
      const { tags } = buildTags();
      saveRecipeMutation.mutate({ title: meta.title, content: generatedRecipeContent, tags });
    }
  };

  const handleBackToIdeas = () => {
    setGeneratedRecipeContent(null);
    setSmartRecipe(null);
    setSelectedIdea(null);
    setSelectedSavedRecipe(null);
    setError(null);

    scrollToResultsOnMobile();
  };

  const LoadingIcon = LOADING_STATES[loadingStateIndex].icon;

  const canSaveGeneratedRecipe = Boolean(generatedRecipeContent && selectedIdea);
  const heroBadge = mainTab === 'SUPPORT' ? 'PTO Support' : 'PTO Ai-Powered Nutrition';
  const heroAccent = mainTab === 'SUPPORT' ? 'Support' : 'Ai Kocken';
  const heroDescription =
    mainTab === 'SUPPORT'
      ? 'Få hjälp med frågor om appen, konto och teknik — vi svarar snabbt.'
      : (
          <>
            Generera veckomenyer med recept och inköpslistor - <br className="hidden md:block" />
            Skräddarsytt för att passa med din kostplan från PTO.
          </>
        );

  return (
    <div className="animate-fade-in-up pb-20 overflow-x-hidden">
      {/* 1. HERO SECTION - Mobilanpassad med mindre padding */}
      <div className="relative bg-[#0f172a] pt-10 pb-16 px-4 md:pt-16 md:pb-24 md:px-6 text-center overflow-hidden rounded-b-[2.5rem] md:rounded-b-[3rem] shadow-2xl mb-8 md:mb-12 border-b border-white/5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[600px] h-[600px] bg-[#a0c81d]/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#a0c81d] text-[10px] md:text-xs font-bold uppercase tracking-widest mb-4 md:mb-6 backdrop-blur-sm shadow-lg whitespace-nowrap">
            <Sparkles className="w-3 h-3" /> {heroBadge}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-7xl font-black text-white font-heading tracking-tight leading-none mb-4">
            PTO <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a0c81d] to-emerald-400">{heroAccent}</span>
          </h1>

          <p className="text-slate-300/90 text-sm md:text-lg font-medium max-w-lg md:max-w-2xl leading-relaxed px-2">
            {heroDescription}
          </p>
        </div>
      </div>

      {/* Main Content Width Increased */}
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex justify-center mb-8 w-full">
          <div className="grid grid-cols-3 bg-[#1e293b] p-1.5 rounded-2xl shadow-xl border border-white/5 gap-2 w-full max-w-2xl">
            <button
              onClick={() => setMainTab('WEEKLY')}
              className={`flex items-center justify-center gap-2 px-2 py-3 md:py-4 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-sm transition-all ${mainTab === 'WEEKLY'
                ? 'bg-[#a0c81d] text-[#0f172a]'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              <CalendarDays className="w-4 h-4 md:w-5 md:h-5" /> Kostschema
            </button>

            <button
              onClick={() => setMainTab('RECIPES')}
              className={`flex items-center justify-center gap-2 px-2 py-3 md:py-4 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-sm transition-all ${mainTab === 'RECIPES'
                ? 'bg-[#a0c81d] text-[#0f172a]'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              <ChefHat className="w-4 h-4 md:w-5 md:h-5" /> Måltidsförslag
            </button>

            <button
              onClick={() => setMainTab('SUPPORT')}
              className={`flex items-center justify-center gap-2 px-2 py-3 md:py-4 rounded-xl font-black uppercase tracking-widest text-[10px] md:text-sm transition-all ${mainTab === 'SUPPORT'
                ? 'bg-[#a0c81d] text-[#0f172a]'
                : 'text-slate-400 hover:text-white'
                }`}
            >
              <LifeBuoy className="w-4 h-4 md:w-5 md:h-5" /> Support
            </button>
          </div>
        </div>

        {mainTab === 'WEEKLY' && <WeeklyPlanner />}

        {mainTab === 'SUPPORT' && (
          <div className="flex flex-col gap-8 w-full">
            <SupportChat />
          </div>
        )}

        {mainTab === 'RECIPES' && (
          <div className="flex flex-col gap-8 w-full">
            {/* Sub-tabs Centered */}
            <div className="flex justify-center mb-2">
              <div className="grid grid-cols-2 bg-[#1e293b] p-1 rounded-lg border border-white/5 w-full max-w-sm">
                <button
                  onClick={() => setActiveSubTab('GENERATOR')}
                  className={`flex items-center justify-center py-2.5 rounded-md text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all ${activeSubTab === 'GENERATOR'
                    ? 'bg-[#a0c81d] text-[#0f172a]'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Skräddarsy
                </button>
                <button
                  onClick={() => setActiveSubTab('LIBRARY')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-md text-[10px] md:text-xs font-bold uppercase tracking-wide transition-all ${activeSubTab === 'LIBRARY'
                    ? 'bg-white text-[#0f172a]'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Min Kokbok
                </button>
              </div>
            </div>

            {activeSubTab === 'GENERATOR' ? (
              /* DESKTOP SPLIT VIEW FOR GENERATOR */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* LEFT COLUMN: CONTROLS */}
                <div className="lg:col-span-4 w-full">
                  <div className="bg-[#1e293b] rounded-[2rem] shadow-2xl border border-white/5 overflow-hidden animate-fade-in lg:sticky lg:top-24">
                    <div className="p-6 md:p-8 border-b border-white/5 bg-[#172030]">
                      <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Utensils className="w-4 h-4 text-[#a0c81d]" /> Vilken måltid?
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {MEAL_TYPES.map(meal => (
                          <button
                            key={meal.id}
                            onClick={() => setSelectedMealType(prev => (prev === meal.id ? 'Alla' : meal.id))}
                            className={`p-3 md:p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${selectedMealType === meal.id
                              ? 'bg-[#a0c81d] text-[#0f172a]'
                              : 'bg-[#1e293b] border-white/10 text-slate-400 hover:border-[#a0c81d]/30'
                              }`}
                          >
                            <meal.icon className="w-5 h-5 md:w-6 md:h-6" /> <span className="font-bold text-[10px] md:text-xs uppercase">{meal.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-6 md:p-8 space-y-6 md:space-y-8">
                      <div className="space-y-6">
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Kök & Stil</label>
                          <div className="flex flex-wrap gap-2">
                            {STYLE_PREFS.map(pref => (
                              <button
                                key={pref.id}
                                onClick={() => togglePreference('styles', pref.id)}
                                aria-pressed={preferences.styles.includes(pref.id)}
                                className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${preferences.styles.includes(pref.id)
                                  ? 'bg-[#a0c81d] text-[#0f172a]'
                                  : 'bg-[#0f172a] text-slate-400 border-white/10'
                                  }`}
                              >
                                {pref.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Hälsa & Mål</label>
                          <div className="flex flex-wrap gap-2">
                            {NUTRITION_PREFS.map(pref => (
                              <button
                                key={pref.id}
                                onClick={() => togglePreference('nutrition', pref.id)}
                                aria-pressed={preferences.nutrition.includes(pref.id)}
                                className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${preferences.nutrition.includes(pref.id)
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[#0f172a] text-slate-400 border-white/10'
                                  }`}
                              >
                                {pref.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex items-center gap-2 text-[10px] font-black uppercase text-[#a0c81d] hover:text-[#b5e02e] transition-colors"
                        >
                          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {showAdvanced ? 'Dölj avancerade val' : 'Fler anpassningar'}
                        </button>

                        {showAdvanced && (
                          <div className="mt-6 space-y-8 animate-fade-in">
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Max Tidsåtgång</label>
                              <div className="grid grid-cols-3 gap-2">
                                {TIME_PREFS.map(t => (
                                  <button
                                    key={t.id}
                                    onClick={() => setSelectedTime(prev => (prev === t.id ? '' : t.id))}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-[9px] font-bold uppercase transition-all ${selectedTime === t.id
                                      ? 'bg-[#a0c81d] text-[#0f172a] border-[#a0c81d]'
                                      : 'bg-[#0f172a] text-slate-500 border-white/5 hover:border-white/20'
                                      }`}
                                  >
                                    <t.icon className="w-4 h-4 mb-1" /> {t.label.split('(')[0]}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 block">Önskat Protein</label>
                              <div className="flex flex-wrap gap-2">
                                {PROTEIN_PREFS.map(p => (
                                  <button
                                    key={p.id}
                                    onClick={() => toggleProtein(p.id)}
                                    aria-pressed={selectedProtein.includes(p.id)}
                                    className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all border ${selectedProtein.includes(p.id)
                                      ? 'bg-cyan-500 text-white border-cyan-400'
                                      : 'bg-[#0f172a] text-slate-500 border-white/5'
                                      }`}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="pt-4 border-t border-white/5">
                              <label className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 block flex items-center gap-2">
                                <MinusCircle className="w-4 h-4" /> Uteslut Ingredienser
                              </label>
                              <input
                                type="text"
                                value={excludeIngredients}
                                onChange={(e) => setExcludeIngredients(e.target.value)}
                                placeholder="T.ex. svamp, koriander..."
                                className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-red-400 focus:outline-none placeholder:text-slate-600"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="pt-6 border-t border-white/5">
                        <label className="text-xs font-bold text-[#a0c81d] uppercase tracking-widest mb-3 block">Särskilda önskemål (Magic Input)</label>
                        <input
                          type="text"
                          value={magicRequest}
                          onChange={(e) => setMagicRequest(e.target.value)}
                          placeholder="T.ex. Krämigt med saffran..."
                          className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#a0c81d] focus:outline-none"
                        />
                      </div>

                      <button
                        onClick={handleGetIdeas}
                        disabled={isGenerating || isWritingRecipe}
                        className="w-full py-5 rounded-2xl bg-[#a0c81d] text-[#0f172a] font-black uppercase tracking-widest hover:bg-[#b5e02e] transition-all flex justify-center gap-2 shadow-xl shadow-[#a0c81d]/10"
                      >
                        {isGenerating || isWritingRecipe
                          ? <><Loader2 className="w-5 h-5 animate-spin" /> ARBETAR...</>
                          : <><Sparkles className="w-5 h-5" /> LÅT PTO Ai SKAPA</>
                        }
                      </button>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN: RESULTS */}
                <div className="lg:col-span-8 w-full" ref={resultsRef}>
                  {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl mb-8 flex items-center gap-3 animate-fade-in">
                      <MinusCircle className="w-5 h-5" /> {error}
                    </div>
                  )}

                  <div className={`
                    bg-[#1e293b] shadow-2xl border border-white/5 flex flex-col transition-all duration-500
                    ${isViewingRecipe
                      ? 'fixed inset-0 z-[100] h-[100dvh] w-full rounded-none lg:relative lg:inset-auto lg:h-auto lg:min-h-[600px] lg:w-auto lg:rounded-[2.5rem] lg:z-auto lg:overflow-hidden'
                      : 'relative rounded-[2.5rem] min-h-[400px] md:min-h-[600px] overflow-hidden'
                    }
                    ${!ideas.length && !isGenerating && !isWritingRecipe && !isViewingRecipe ? 'opacity-50 lg:opacity-100' : ''}
                  `}>

                    {(isGenerating || isWritingRecipe) && (
                      <div className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-md flex flex-col items-center justify-center space-y-8 animate-fade-in">
                        <div className="relative">
                          <div className="w-40 h-40 border-4 border-slate-800 border-t-[#a0c81d] rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <LoadingIcon className="w-12 h-12 text-[#a0c81d] animate-pulse" />
                          </div>
                        </div>
                        <div className="text-center">
                          <h3 className="text-3xl font-black text-white animate-pulse">{LOADING_STATES[loadingStateIndex].text}</h3>
                        </div>
                      </div>
                    )}

                    {/* EMPTY STATE FOR RIGHT COLUMN (DESKTOP) */}
                    {!isGenerating && !isWritingRecipe && ideas.length === 0 && !generatedRecipeContent && !selectedSavedRecipe && !smartRecipe && (
                      <div className="hidden lg:flex flex-col items-center justify-center h-full text-slate-500">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                          <ChefHat className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="font-bold text-lg">Dina resultat visas här</p>
                        <p className="text-sm opacity-60">Gör dina val till vänster och klicka på skapa.</p>
                      </div>
                    )}

                    {!isGenerating && !isWritingRecipe && ideas.length > 0 && !smartRecipe && !selectedSavedRecipe && !generatedRecipeContent && (
                      <div className="p-8 md:p-12 animate-fade-in space-y-8">
                        <div className="flex justify-between items-center">
                          <h3 className="text-2xl font-black text-white">{ideas.length} Skräddarsydda Förslag</h3>
                          <button onClick={() => setIdeas([])} className="text-slate-500 hover:text-white uppercase text-[10px] font-bold">Rensa</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {ideas.map((idea, index) => {
                            const meta = normalizeIdea(idea as IdeaLike);

                            return (
                              <div
                                key={index}
                                onClick={() => handleSelectIdea(idea)}
                                className="bg-[#0f172a] p-8 rounded-[2.5rem] border border-white/5 hover:border-[#a0c81d] cursor-pointer group transition-all relative overflow-hidden"
                              >
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-[#a0c81d]/5 transition-colors"></div>

                                <h4 className="font-black text-white text-2xl mb-4 group-hover:text-[#a0c81d] transition-colors leading-tight">{meta.title}</h4>
                                <p className="text-slate-400 line-clamp-2 text-sm leading-relaxed mb-6 font-medium opacity-80">{meta.description}</p>

                                <div className="flex flex-wrap gap-2">
                                  <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl text-amber-500">
                                    <Flame className="w-3 h-3" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">{meta.calories ?? "???"} kcal</span>
                                  </div>

                                  <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl text-emerald-400">
                                    <Weight className="w-3 h-3" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">
                                      {meta.proteinGrams ? `${meta.proteinGrams}g Protein` : '??g Protein'}
                                    </span>
                                  </div>

                                  {meta.tags.map((tag, tIdx) => (
                                    <div key={tIdx} className="flex items-center gap-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl text-slate-300">
                                      {tag.toLowerCase().includes('veg') && <Leaf className="w-3 h-3 text-green-400" />}
                                      {tag.toLowerCase().includes('protein') && <Zap className="w-3 h-3 text-cyan-400" />}
                                      <span className="text-[10px] font-bold uppercase tracking-wider">{tag}</span>
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-8 flex items-center text-[10px] font-black uppercase tracking-widest text-[#a0c81d] opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                  Visa fullständigt recept <ArrowRight className="w-3 h-3 ml-2" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {!isGenerating && !isWritingRecipe && (
                      <div className="animate-fade-in h-full flex flex-col">
                        {smartRecipe ? (
                          <div className="bg-white h-full">
                            <RecipeCard
                              recipe={smartRecipe}
                              onSave={handleSaveRecipe}
                              onClose={handleBackToIdeas}
                              isSaving={saveRecipeMutation.isPending}
                              isPremium={isPremium}
                              showSaveSuccess={showSaveSuccess}
                            />
                          </div>
                        ) : (selectedSavedRecipe || generatedRecipeContent) ? (
                          <div className="bg-white h-full flex flex-col relative">
                            <div className="flex flex-wrap items-center justify-between p-4 md:p-6 border-b border-slate-100 bg-white/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
                              <button onClick={handleBackToIdeas} className="flex items-center gap-2 text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-colors active:scale-95">
                                <ArrowLeft className="w-4 h-4" /> Tillbaka
                              </button>

                              {/* Visa bara Spara-knappen när det faktiskt går att spara (genererat recept + selectedIdea) */}
                              {canSaveGeneratedRecipe && (
                                <button
                                  onClick={handleSaveRecipe}
                                  disabled={saveRecipeMutation.isPending || showSaveSuccess}
                                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase transition-all shadow-md active:scale-95 ${showSaveSuccess
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-[#0f172a] text-white hover:bg-slate-800'
                                    }`}
                                >
                                  {saveRecipeMutation.isPending
                                    ? <Loader2 className="w-4 h-4 animate-spin" />
                                    : showSaveSuccess
                                      ? <><CheckCircle2 className="w-4 h-4" /> Sparat</>
                                      : <><Heart className="w-4 h-4" /> Spara</>
                                  }
                                </button>
                              )}
                            </div>

                            <div className="prose prose-slate prose-lg max-w-none p-8 md:p-16 pb-32 overflow-y-auto custom-scrollbar">
                              <ReactMarkdown
                                components={{
                                  h1: ({ node, ...props }) => (
                                    <h1
                                      {...props}
                                      className="text-4xl md:text-6xl font-black text-slate-900 mb-10 pb-8 border-b border-slate-100 font-heading leading-tight tracking-tight"
                                    />
                                  ),
                                  h2: ({ node, ...props }) => (
                                    <h2
                                      {...props}
                                      className="text-xl font-bold text-[#0f172a] bg-[#a0c81d] inline-block px-4 py-1.5 rounded-lg mt-12 mb-6 font-heading uppercase tracking-wide shadow-lg text-white transform -rotate-1"
                                    />
                                  ),
                                  ul: ({ node, children, ...props }) => (
                                    <ul
                                      {...props}
                                      className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 list-none p-8 bg-slate-50 rounded-3xl border border-slate-100 my-10"
                                    >
                                      {children}
                                    </ul>
                                  ),
                                  li: ({ node, children, ...props }) => (
                                    <li
                                      {...props}
                                      className="flex items-start gap-3 text-slate-700 text-base py-1 font-medium"
                                    >
                                      <span className="mt-2 w-2 h-2 bg-[#a0c81d] rounded-full shrink-0 block" />
                                      <span>{children}</span>
                                    </li>
                                  ),
                                  blockquote: ({ node, children, ...props }) => (
                                    <blockquote
                                      {...props}
                                      className="border-l-4 border-[#a0c81d] pl-6 italic text-slate-500 bg-gradient-to-r from-slate-50 to-white p-6 rounded-r-2xl my-12"
                                    >
                                      {children}
                                    </blockquote>
                                  )
                                }}
                              >
                                {selectedSavedRecipe?.instructions || selectedSavedRecipe?.content || (typeof generatedRecipeContent === 'string' ? generatedRecipeContent : "")}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* LIBRARY VIEW */
              <div className="bg-[#1e293b] rounded-[2rem] shadow-2xl border border-white/5 p-8 min-h-[400px]">
                {!isAuthenticated ? (
                  <div className="text-center py-20">
                    <Lock className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">Logga in för att se din kokbok</h3>
                    <p className="text-slate-400 mb-6">Spara dina favoritrecept och få tillgång till dem när som helst.</p>
                    <button onClick={() => navigate('/auth')} className="bg-[#a0c81d] text-[#0f172a] px-8 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#b5e02e] transition-all">Logga in</button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Sök i din kokbok..."
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      className="w-full bg-[#0f172a] border border-white/10 rounded-2xl py-4 px-4 text-white mb-6 focus:border-[#a0c81d] outline-none"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredSavedRecipes.map(r => (
                        <div
                          key={r.id}
                          onClick={() => {
                            setSelectedSavedRecipe(r);
                            setActiveSubTab('GENERATOR');
                            scrollToResultsOnMobile();
                          }}
                          className="p-5 rounded-2xl bg-[#0f172a] border border-white/5 hover:border-[#a0c81d] cursor-pointer group relative overflow-hidden transition-all hover:-translate-y-1"
                        >
                          <h4 className="font-bold text-white group-hover:text-[#a0c81d]">{r.title}</h4>
                          <p className="text-xs text-slate-500 mt-2">Sparad {new Date(r.created_at).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeBank;
