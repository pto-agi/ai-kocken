
import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Loader2, CalendarDays, Printer, Coffee, Sun, Moon, X,
  Save, Brain, ChefHat, Settings2, AlertTriangle, Minus,
  Plus, Leaf, Beef, Fish, Check, Target, ShoppingBasket,
  RefreshCw, CheckCircle2, Flame, PieChart, ChevronRight,
  ArrowLeft, Utensils, Info
} from 'lucide-react';
import { generateWeeklyPlan, generateFullRecipe, swapMeal, WeeklyPlanRequest, generateFullWeeklyDetails } from '../services/geminiService';
import { databaseService } from '../services/databaseService';
import { useAuthStore } from '../store/authStore';
import ReactMarkdown from 'react-markdown';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateWeeklySchedulePDF } from '../utils/pdfGenerator';
import { useNavigate } from 'react-router-dom';

// --- CONFIG ---
const LOADING_STATES = [
  { text: "Tolkar dina mål, preferenser och allergier...", icon: Brain },
  { text: "Beräknar energi och makrofördelning...", icon: PieChart },
  { text: "Väljer rätter efter stil och variation...", icon: Utensils },
  { text: "Sätter ihop recept som passar din vardag...", icon: ChefHat },
  { text: "Skapar portionsmängder och inköpslista...", icon: ShoppingBasket },
  { text: "Finjusterar veckan och låser planen...", icon: CalendarDays }
];

const DIET_TYPES = [
  { id: 'omnivore', label: 'Allätare', icon: Beef },
  { id: 'pescatarian', label: 'Pescetarian', icon: Fish },
  { id: 'vegetarian', label: 'Vegetariskt', icon: Leaf },
  { id: 'vegan', label: 'Veganskt', icon: Leaf },
];

const MACRO_PRESETS = [
  { id: 'balanced', label: 'Balanserad', p: 35, c: 35, f: 30 },
  { id: 'lowcarb', label: 'Low Carb', p: 40, c: 20, f: 40 },
  { id: 'keto', label: 'Keto', p: 25, c: 5, f: 70 },
  { id: 'highprotein', label: 'High Protein', p: 50, c: 30, f: 20 },
];


// --- HELPERS ---
const n = (v: any, fallback = 0) => {
  if (v === undefined || v === null) return null; 
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const nDisplay = (v: any) => {
  const num = n(v, 0);
  return num === null ? 0 : num;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const InfoTip: React.FC<{ text: string }> = ({ text }) => (
  <span className="relative inline-flex items-center group">
    <button
      type="button"
      aria-label="Info"
      className="ml-2 w-5 h-5 rounded-full border border-[#DAD1C5] bg-[#F4F0E6] text-[#6B6158] flex items-center justify-center hover:text-[#3D3D3D] hover:border-[#a0c81d] focus:outline-none focus:ring-2 focus:ring-[#a0c81d]/40"
    >
      <Info className="w-3 h-3" />
    </button>
    <span className="pointer-events-none absolute left-0 top-full mt-2 w-56 rounded-xl border border-[#DAD1C5] bg-[#F4F0E6] px-3 py-2 text-[11px] text-[#6B6158] font-medium shadow-lg opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0">
      {text}
    </span>
  </span>
);

const macroLine = (meal: any) => {
  if (!meal) return "";
  const kcal = nDisplay(meal?.kcal);
  const p = nDisplay(meal?.protein);
  const c = nDisplay(meal?.carbs);
  const f = nDisplay(meal?.fat);

  if (!p && !c && !f) return kcal ? `${kcal} kcal` : "";
  return `${kcal} kcal • P ${p}g • K ${c}g • F ${f}g`;
};

// Custom Markdown Components for consistent styling
const MarkdownComponents = {
  h1: ({ node: _node, ...props }: any) => <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D] mb-6 mt-2 font-heading" {...props} />,
  h2: ({ node: _node, ...props }: any) => <h2 className="text-lg md:text-xl font-bold text-[#a0c81d] mb-4 mt-8 border-b border-[#E6E1D8] pb-2 flex items-center gap-2 uppercase tracking-wide" {...props} />, 
  p: ({ node: _node, ...props }: any) => <p className="text-[#6B6158] leading-relaxed mb-4 text-sm md:text-base font-medium" {...props} />,
  ul: ({ node: _node, ...props }: any) => <ul className="space-y-3 mb-6 bg-[#ffffff]/70 p-6 rounded-2xl border border-[#E6E1D8]" {...props} />,
  ol: ({ node: _node, ...props }: any) => <ol className="space-y-4 mb-6 list-decimal pl-5 text-[#6B6158]" {...props} />,
  li: ({ node: _node, ...props }: any) => (
    <li className="flex items-start gap-3 text-[#6B6158] text-sm md:text-base">
      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#a0c81d] shrink-0" />
      <span className="flex-1">{props.children}</span>
    </li>
  ),
  strong: ({ node: _node, ...props }: any) => <strong className="text-[#3D3D3D] font-black" {...props} />,
  hr: ({ node: _node, ...props }: any) => <hr className="border-[#E6E1D8] my-8" {...props} />
};

const WeeklyPlanner: React.FC = () => {
  const { session, profile } = useAuthStore();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [step, setStep] = useState(1); // 1: Calibration, 2: Fine-tuning, 3: Generation
  
  const [request, setRequest] = useState<WeeklyPlanRequest>({
    language: 'sv',
    days: 7,
    servings: 2,
    mealsPerDay: 3,
    targets: { kcal: 2200, p: 35, c: 35, f: 30 },
    diet: { type: 'omnivore', allergies: '', excludeIngredients: '', mustInclude: '' },
    preferences: {
      categories: [],
      spiceLevel: 'medium',
      varietyLevel: 'balanced',
      leftoversPlan: 'none',
      optimizeShopping: true
    }
  });

  const [currentPlan, setCurrentPlan] = useState<any[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [swappingMeals, setSwappingMeals] = useState<Record<string, boolean>>({});

  const [selectedMeal, setSelectedMeal] = useState<{ name: string, type: string, fullData: any } | null>(null);
  const [recipeContent, setRecipeContent] = useState<string | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [saveOutcome, setSaveOutcome] = useState<'saved' | 'skipped' | 'error' | null>(null);

  const macroSum = request.targets.p + request.targets.c + request.targets.f;
  const isMacroSumValid = macroSum === 100;
  const kcalMin = 1200;
  const kcalMax = 4000;
  const kcalStep = 50;

  // --- EFFECTS ---
  useEffect(() => {
    if (profile?.biometrics?.results) {
      const { targetCalories } = profile.biometrics.results;
      setRequest(prev => ({
        ...prev,
        targets: { ...prev.targets, kcal: targetCalories || 2200 }
      }));
    }
  }, [profile]);

  useEffect(() => {
    let interval: any;
    if (isGenerating || isFinalizing) {
      setLoadingIndex(0);
      interval = setInterval(() => {
        setLoadingIndex(prev => (prev + 1) % LOADING_STATES.length);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isGenerating, isFinalizing]);

  // --- HANDLERS ---

  const handleApplyMacroPreset = (preset: typeof MACRO_PRESETS[0]) => {
    setRequest(prev => ({
      ...prev,
      targets: { ...prev.targets, p: preset.p, c: preset.c, f: preset.f }
    }));
  };

  const adjustKcal = (delta: number) => {
    setRequest(prev => ({
      ...prev,
      targets: { ...prev.targets, kcal: clamp(prev.targets.kcal + delta, kcalMin, kcalMax) }
    }));
  };


  const handleGenerateDraft = async () => {
    if (!isMacroSumValid) {
      alert("Makrofördelningen måste summera till 100%.");
      return;
    }
    setIsGenerating(true);
    setStep(2); // Go to results view to show loading
    setCurrentPlan(null);
    
    // Scroll up
    topRef.current?.scrollIntoView({ behavior: 'smooth' });

    try {
      const plan = await generateWeeklyPlan(request);
      if (!plan || plan.length === 0) throw new Error("Tom plan mottagen");
      setCurrentPlan(plan);
    } catch (error) {
      console.error(error);
      alert("Kunde inte generera planen just nu. Försök igen.");
      setStep(1); // Go back on error
    } finally {
      setIsGenerating(false);
    }
  };

  const mapMealTypeToLegacyKey = (mealType: string): 'breakfast' | 'lunch' | 'dinner' | null => {
    const t = mealType.toLowerCase();
    if (t.includes('frukost')) return 'breakfast';
    if (t.includes('lunch')) return 'lunch';
    if (t.includes('middag')) return 'dinner';
    return null;
  };

  const handleSwapMeal = async (dayIdx: number, mealType: string) => {
    if (!currentPlan) return;
    const legacyKey = mapMealTypeToLegacyKey(mealType);
    const currentMeal =
      currentPlan[dayIdx]?.meals?.find((m: any) => m.type?.toLowerCase().includes(mealType.toLowerCase())) ||
      (legacyKey ? currentPlan[dayIdx]?.[legacyKey] : undefined);
    
    if (!currentMeal) return;

    const key = `${dayIdx}-${mealType}`;
    setSwappingMeals(prev => ({ ...prev, [key]: true }));
    try {
      const newMealData = await swapMeal(currentMeal.name, mealType, request);
      const newPlan = [...currentPlan];
      
      // Update logic for new array structure
      if (newPlan[dayIdx].meals) {
          const mIdx = newPlan[dayIdx].meals.findIndex((m: any) => m.type.toLowerCase().includes(mealType.toLowerCase()));
          if (mIdx !== -1) newPlan[dayIdx].meals[mIdx] = newMealData;
      } else {
          // Fallback old structure
          if (legacyKey) {
            newPlan[dayIdx] = { ...newPlan[dayIdx], [legacyKey]: newMealData };
          }
      }
      
      setCurrentPlan(newPlan);
    } catch {
      alert("Kunde inte byta ut rätten.");
    } finally {
      setSwappingMeals(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleViewRecipe = async (dayIdx: number, mealIdx: number | string) => {
    if (!currentPlan) return;
    
    let meal;
    if (typeof mealIdx === 'number') {
        meal = currentPlan[dayIdx]?.meals?.[mealIdx];
    } else {
        meal = currentPlan[dayIdx]?.[mealIdx];
    }

    if (!meal) return;

    const mealName = meal.name || "Måltid";
    const mealType = meal.type || "Måltid";
    
    setSelectedMeal({ name: mealName, type: mealType, fullData: meal });
    setRecipeLoading(true);
    
    if (meal.instructions && meal.ingredients) {
        const ingredientsList = Array.isArray(meal.ingredients) 
            ? meal.ingredients.map((i: string) => `- ${i}`).join('\n') 
            : "";
        const md = `
## Ingredienser

${ingredientsList}

## Gör så här

${meal.instructions}

---

**Näringsvärde:** ${meal.kcal} kcal | **P:** ${meal.protein}g | **K:** ${meal.carbs}g | **F:** ${meal.fat}g
        `;
        setRecipeContent(md);
        setRecipeLoading(false);
    } else {
        try {
            const t = mealType.toLowerCase();
            let targetKcal = Math.round(request.targets.kcal / request.mealsPerDay);
            if (t.includes('mellan') || t.includes('snack')) {
              targetKcal = Math.round(request.targets.kcal * 0.10);
            } else if (t.includes('frukost')) {
              targetKcal = Math.round(request.targets.kcal * 0.25);
            } else if (t.includes('lunch') || t.includes('middag')) {
              targetKcal = Math.round(request.targets.kcal * 0.35);
            }

            const extraContext = [
              `${mealType}. Mål: ca ${targetKcal} kcal.`,
              request.diet?.excludeIngredients ? `Uteslut: ${request.diet.excludeIngredients}.` : '',
              request.diet?.mustInclude ? `Måste inkludera: ${request.diet.mustInclude}.` : ''
            ].filter(Boolean).join(' ');

            const content = await generateFullRecipe(
                mealName,
                extraContext,
                request.preferences?.categories,
                request.diet?.allergies
            );
            setRecipeContent(typeof content === 'string' ? content : "Receptdata felaktig.");
        } catch {
            setRecipeContent("Kunde inte ladda receptet. Kontrollera din anslutning.");
        } finally {
            setRecipeLoading(false);
        }
    }
  };

  // --- STEP 3: FINALIZE & PRINT ---
  const handleFinalizeAndPrint = async () => {
    if (!currentPlan) return;
    
    setStep(3);
    setIsFinalizing(true);
    setSaveOutcome(null);
    
    try {
        // 1. Generate full details (ingredients/instructions) for all meals
        const detailedPlan = await generateFullWeeklyDetails(currentPlan, request.targets);
        
        // 2. Save to DB if logged in
        if (userId) {
            const saved = await databaseService.saveWeeklyPlan(userId, detailedPlan, `Veckomeny (${new Date().toLocaleDateString()})`);
            if (!saved) {
                setSaveOutcome('error');
                alert("Kunde inte spara veckomenyn. Kontrollera inloggning eller rättigheter.");
            } else {
                setSaveOutcome('saved');
                queryClient.invalidateQueries({ queryKey: ['weeklyPlans', userId] });
            }
        } else {
            setSaveOutcome('skipped');
            if (window.confirm("Logga in för att spara veckomenyn i din profil. Vill du logga in nu?")) {
                navigate('/auth');
            }
        }

        // 3. Create PDF
        generateWeeklySchedulePDF(detailedPlan, request.targets);

    } catch (e) {
        console.error(e);
        alert("Något gick fel vid genereringen. Försök igen.");
        setStep(2); // Go back on error
    } finally {
        setIsFinalizing(false);
    }
  };

  const saveRecipeMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !selectedMeal || !recipeContent) return;
      return await databaseService.saveRecipe({
        user_id: userId,
        title: selectedMeal.name,
        instructions: recipeContent,
        tags: ["Veckomeny", selectedMeal.type],
        ingredients: selectedMeal.fullData?.ingredients || [],
        macros: {
            calories: selectedMeal.fullData?.kcal,
            protein: selectedMeal.fullData?.protein,
            carbs: selectedMeal.fullData?.carbs,
            fats: selectedMeal.fullData?.fat
        },
        cooking_time: "Enligt recept"
      });
    },
    onSuccess: () => {
      alert("Receptet sparat!");
      queryClient.invalidateQueries({ queryKey: ['savedRecipes'] });
    }
  });

  const LoadingIcon = LOADING_STATES[loadingIndex].icon;

  return (
    <div className="animate-fade-in pb-20 max-w-6xl mx-auto px-4 md:px-6" ref={topRef}>
      
      {/* Header */}
      <div className="mb-8 pt-8 md:pt-12 text-center">
        <div className="flex items-center justify-center mb-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E6E1D8] bg-[#ffffff]/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158]">
            <CalendarDays className="w-3 h-3 text-[#a0c81d]" /> Veckomeny
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-[#3D3D3D] font-heading tracking-tight mb-2">
          Finjustera ditt <span className="text-[#a0c81d]">kostschema</span>
        </h1>
        <p className="text-[#6B6158] font-medium text-sm md:text-base max-w-2xl mx-auto">
          {step === 1 && (
            <>
              Bygg ett personligt kostschema med recept till varje måltid. Välj mål, preferenser och upplägg – vi skapar ett 7‑dagars schema med recept och inköpslista som matchar dina val.
              <br />
              <br />
              När det är klart sparas schemat i din profil och kan laddas ner som komplett PDF.
            </>
          )}
          {step === 2 && "Steg 2: Granska och finjustera"}
          {step === 3 && "Steg 3: Genererar slutgiltig plan"}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="max-w-xl mx-auto mb-12">
        <div className="relative mb-6">
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-[#E6E1D8]"></div>
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#7FA61A] transition-all duration-500"
            style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-6">
          {[
            { id: 1, label: 'Kalibrering', icon: Target, color: 'text-[#7FA61A]', ring: 'ring-[#7FA61A]/25', bg: 'bg-[#7FA61A]' },
            { id: 2, label: 'Finjustering', icon: Settings2, color: 'text-[#5F8F2B]', ring: 'ring-[#5F8F2B]/25', bg: 'bg-[#5F8F2B]' },
            { id: 3, label: 'Resultat', icon: CheckCircle2, color: 'text-[#2F6D3A]', ring: 'ring-[#2F6D3A]/25', bg: 'bg-[#2F6D3A]' }
          ].map((s) => {
            const isActive = step >= s.id;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex flex-col items-center text-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border border-[#DAD1C5] ${isActive ? 'bg-[#F4F0E6]' : 'bg-[#F6F1E7]'} ${isActive ? s.color : 'text-[#8A8177]'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all duration-300 ${
                    isActive
                      ? `${s.bg} text-[#F6F1E7] border-[#F6F1E7] ring-4 ${s.ring} shadow-[0_0_14px_rgba(127,166,26,0.25)]`
                      : 'bg-[#F4F0E6] border-[#E6E1D8] text-[#6B6158]'
                  }`}
                >
                  {s.id}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? s.color : 'text-[#8A8177]'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className={`rounded-[2.5rem] border shadow-2xl overflow-hidden relative min-h-[500px] transition-colors ${
        step === 1 ? 'bg-[#52574A] border-[#6B6158] shadow-[0_30px_80px_rgba(61,61,61,0.22)]' : 'bg-[#E8F1D5] border-[#E6E1D8]'
      }`}>
        
        {/* === STEP 1: CALIBRATION === */}
        {step === 1 && (
            <div className="p-8 md:p-12 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    
                    {/* LEFT: VOLUME & TARGETS */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-[#a0c81d]/15 p-2 rounded-xl text-[#a0c81d]"><Target className="w-5 h-5" /></div>
                            <h3 className="text-xl font-black text-[#F6F1E7] font-heading uppercase tracking-wide">Mål & Volym</h3>
                        </div>

                        <div className="bg-[#F4F0E6] p-6 rounded-2xl border border-[#DAD1C5] space-y-6">
                            {/* Calories */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest">Dagligt Energimål</label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => adjustKcal(-kcalStep)}
                                            className="w-7 h-7 flex items-center justify-center bg-[#F4F0E6] rounded-lg text-[#6B6158] hover:text-[#3D3D3D] hover:bg-[#ffffff]/95 transition-colors border border-[#DAD1C5]"
                                        >
                                            <Minus className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="text-2xl font-black text-[#a0c81d]">{request.targets.kcal} <span className="text-sm text-[#6B6158]">kcal</span></span>
                                        <button
                                            type="button"
                                            onClick={() => adjustKcal(kcalStep)}
                                            className="w-7 h-7 flex items-center justify-center bg-[#F4F0E6] rounded-lg text-[#6B6158] hover:text-[#3D3D3D] hover:bg-[#ffffff]/95 transition-colors border border-[#DAD1C5]"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <input 
                                    type="range" min={kcalMin} max={kcalMax} step={kcalStep}
                                    value={request.targets.kcal} 
                                    onChange={(e) => setRequest(p => ({ ...p, targets: { ...p.targets, kcal: Number(e.target.value) } }))} 
                                    className="w-full accent-[#a0c81d] h-2 bg-[#DAD1C5] rounded-lg appearance-none cursor-pointer" 
                                />
                            </div>

                            {/* Servings & Meals */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block mb-2 flex items-center">
                                        Portioner
                                        <InfoTip text="Recepten anpassas efter antal portioner så att mängderna stämmer." />
                                    </label>
                                    <div className="flex items-center justify-between bg-[#EAE2D5] rounded-xl p-2 border border-[#DAD1C5]">
                                        <button onClick={() => setRequest(p => ({ ...p, servings: Math.max(1, p.servings - 1) }))} className="w-8 h-8 flex items-center justify-center bg-[#F4F0E6] rounded-lg text-[#6B6158] hover:text-[#3D3D3D] hover:bg-[#ffffff]/95 transition-colors"><Minus className="w-4 h-4" /></button>
                                        <span className="font-black text-[#3D3D3D]">{request.servings}</span>
                                        <button onClick={() => setRequest(p => ({ ...p, servings: Math.min(12, p.servings + 1) }))} className="w-8 h-8 flex items-center justify-center bg-[#F4F0E6] rounded-lg text-[#6B6158] hover:text-[#3D3D3D] hover:bg-[#ffffff]/95 transition-colors"><Plus className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block mb-2 flex items-center">
                                        Måltider / Dag
                                        <InfoTip text="Hur många måltider du vill planera för per dag. Påverkar frukost/lunch/middag och mellanmål." />
                                    </label>
                                    <div className="flex items-center justify-between bg-[#EAE2D5] rounded-xl p-2 border border-[#DAD1C5]">
                                        <button onClick={() => setRequest(p => ({ ...p, mealsPerDay: Math.max(3, p.mealsPerDay - 1) }))} className="w-8 h-8 flex items-center justify-center bg-[#F4F0E6] rounded-lg text-[#6B6158] hover:text-[#3D3D3D] hover:bg-[#ffffff]/95 transition-colors"><Minus className="w-4 h-4" /></button>
                                        <span className="font-black text-[#3D3D3D]">{request.mealsPerDay}</span>
                                        <button onClick={() => setRequest(p => ({ ...p, mealsPerDay: Math.min(6, p.mealsPerDay + 1) }))} className="w-8 h-8 flex items-center justify-center bg-[#F4F0E6] rounded-lg text-[#6B6158] hover:text-[#3D3D3D] hover:bg-[#ffffff]/95 transition-colors"><Plus className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-[#E6E1D8] uppercase tracking-widest block mb-3 flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> Allergier & Undantag</label>
                            <div className="space-y-3">
                                <div className="bg-[#F4F0E6] border border-[#DAD1C5] rounded-xl px-3 py-2.5 min-h-[104px] flex flex-col justify-between">
                                    <div className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest mb-2">Allergier / Intoleranser</div>
                                    <textarea
                                        value={request.diet.allergies}
                                        onChange={(e) => setRequest(p => ({ ...p, diet: { ...p.diet, allergies: e.target.value } }))}
                                        className="w-full bg-transparent text-sm text-[#3D3D3D] outline-none placeholder-slate-600 font-medium resize-none"
                                        rows={2}
                                    />
                                    <div className="text-[10px] text-[#8A8177]">Strikta allergier vi aldrig får använda.</div>
                                </div>
                                <div className="bg-[#F4F0E6] border border-[#DAD1C5] rounded-xl px-3 py-2.5 min-h-[104px] flex flex-col justify-between">
                                    <div className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest mb-2">Uteslut Ingredienser</div>
                                    <textarea
                                        value={request.diet.excludeIngredients}
                                        onChange={(e) => setRequest(p => ({ ...p, diet: { ...p.diet, excludeIngredients: e.target.value } }))}
                                        className="w-full bg-transparent text-sm text-[#3D3D3D] outline-none placeholder-slate-600 font-medium resize-none"
                                        rows={2}
                                    />
                                    <div className="text-[10px] text-[#8A8177]">Smaker eller råvaror du vill undvika.</div>
                                </div>
                                <div className="bg-[#F4F0E6] border border-[#DAD1C5] rounded-xl px-3 py-2.5 min-h-[104px] flex flex-col justify-between">
                                    <div className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest mb-2">Måste Inkludera</div>
                                    <input
                                        type="text"
                                        value={request.diet.mustInclude}
                                        onChange={(e) => setRequest(p => ({ ...p, diet: { ...p.diet, mustInclude: e.target.value } }))}
                                        className="w-full bg-transparent text-sm text-[#3D3D3D] outline-none placeholder-slate-600 font-medium"
                                    />
                                    <div className="text-[10px] text-[#8A8177]">Råvaror du vill bygga veckan kring.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: MACROS & PREFS */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-purple-500/15 p-2 rounded-xl text-purple-300"><PieChart className="w-5 h-5" /></div>
                            <h3 className="text-xl font-black text-[#F6F1E7] font-heading uppercase tracking-wide">Makro & Preferens</h3>
                        </div>

                        <div className="bg-[#F4F0E6] p-6 rounded-2xl border border-[#DAD1C5] space-y-6">
                            {/* Diet Type - Updated to Pills */}
                            <div>
                                <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block mb-3">Kosthållning</label>
                                <div className="flex flex-wrap gap-2">
                                    {DIET_TYPES.map(diet => (
                                        <button 
                                            key={diet.id} 
                                            onClick={() => setRequest(p => ({ ...p, diet: { ...p.diet, type: diet.id } }))}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                                                request.diet.type === diet.id 
                                                ? 'bg-[#a0c81d] text-[#F6F1E7] border-[#a0c81d]' 
                                                : 'bg-[#EAE2D5] text-[#6B6158] border-[#DAD1C5] hover:border-[#DAD1C5]'
                                            }`}
                                        >
                                            <diet.icon className="w-3.5 h-3.5" />
                                            {diet.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-[#DAD1C5] pt-4"></div>
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest">Välj Inriktning</label>
                                <span className={`inline-flex items-center h-6 text-[10px] font-bold px-2 rounded leading-none transition-colors ${isMacroSumValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                    Totalt: {macroSum}%
                                </span>
                            </div>
                            
                            <div className="flex flex-wrap gap-2">
                                {MACRO_PRESETS.map(preset => (
                                    <button 
                                        key={preset.id} 
                                        onClick={() => handleApplyMacroPreset(preset)}
                                        className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                                            request.targets.p === preset.p && request.targets.c === preset.c 
                                            ? 'bg-[#a0c81d] text-[#F6F1E7] border-[#a0c81d]' 
                                            : 'bg-[#EAE2D5] text-[#6B6158] border-[#DAD1C5] hover:border-[#DAD1C5]'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4 pt-2 border-t border-[#DAD1C5]">
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-2">
                                        <span className="text-emerald-400 uppercase tracking-wider">Protein</span>
                                        <span className="text-[#3D3D3D]">{request.targets.p}%</span>
                                    </div>
                                    <input 
                                      type="range" min="0" max="100" step="5" 
                                      value={request.targets.p} 
                                      onChange={(e) => setRequest(p => ({ ...p, targets: { ...p.targets, p: Number(e.target.value) } }))} 
                                      className="w-full accent-emerald-500 h-1.5 bg-[#DAD1C5] rounded-lg appearance-none cursor-pointer" 
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-2">
                                        <span className="text-blue-400 uppercase tracking-wider">Kolhydrater</span>
                                        <span className="text-[#3D3D3D]">{request.targets.c}%</span>
                                    </div>
                                    <input 
                                      type="range" min="0" max="100" step="5" 
                                      value={request.targets.c} 
                                      onChange={(e) => setRequest(p => ({ ...p, targets: { ...p.targets, c: Number(e.target.value) } }))} 
                                      className="w-full accent-blue-500 h-1.5 bg-[#DAD1C5] rounded-lg appearance-none cursor-pointer" 
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-2">
                                        <span className="text-amber-400 uppercase tracking-wider">Fett</span>
                                        <span className="text-[#3D3D3D]">{request.targets.f}%</span>
                                    </div>
                                    <input 
                                      type="range" min="0" max="100" step="5" 
                                      value={request.targets.f} 
                                      onChange={(e) => setRequest(p => ({ ...p, targets: { ...p.targets, f: Number(e.target.value) } }))} 
                                      className="w-full accent-amber-500 h-1.5 bg-[#DAD1C5] rounded-lg appearance-none cursor-pointer" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#F4F0E6] p-6 rounded-2xl border border-[#DAD1C5] space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <div>
                                    <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block mb-2">Kryddnivå</label>
                                    <select
                                        value={request.preferences.spiceLevel}
                                        onChange={(e) => setRequest(p => ({ ...p, preferences: { ...p.preferences, spiceLevel: e.target.value } }))}
                                        className="w-full bg-[#EAE2D5] border border-[#DAD1C5] rounded-xl px-3 py-3 text-xs text-[#3D3D3D] font-bold uppercase"
                                    >
                                        <option value="mild">Mild</option>
                                        <option value="medium">Medium</option>
                                        <option value="hot">Stark</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block mb-2">Variation</label>
                                    <select
                                        value={request.preferences.varietyLevel}
                                        onChange={(e) => setRequest(p => ({ ...p, preferences: { ...p.preferences, varietyLevel: e.target.value } }))}
                                        className="w-full bg-[#EAE2D5] border border-[#DAD1C5] rounded-xl px-3 py-3 text-xs text-[#3D3D3D] font-bold uppercase"
                                    >
                                        <option value="low">Låg</option>
                                        <option value="balanced">Balanserad</option>
                                        <option value="high">Hög</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest block mb-2">Restplanering</label>
                                    <select
                                        value={request.preferences.leftoversPlan}
                                        onChange={(e) => setRequest(p => ({ ...p, preferences: { ...p.preferences, leftoversPlan: e.target.value } }))}
                                        className="w-full bg-[#EAE2D5] border border-[#DAD1C5] rounded-xl px-3 py-3 text-xs text-[#3D3D3D] font-bold uppercase"
                                    >
                                        <option value="none">Ingen</option>
                                        <option value="some">Viss</option>
                                        <option value="high">Mycket</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <label className="text-[10px] font-black text-[#8A8177] uppercase tracking-widest">Optimera Inköp</label>
                                <button
                                    onClick={() => setRequest(p => ({ ...p, preferences: { ...p.preferences, optimizeShopping: !p.preferences.optimizeShopping } }))}
                                    role="switch"
                                    aria-checked={request.preferences.optimizeShopping}
                                    className={`w-12 h-7 rounded-full p-1 transition-colors ${request.preferences.optimizeShopping ? 'bg-[#a0c81d]' : 'bg-[#DAD1C5]'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${request.preferences.optimizeShopping ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-[#6B6158] flex justify-center">
                    <button 
                        onClick={handleGenerateDraft} 
                        className="w-full md:w-auto px-12 py-5 rounded-2xl bg-[#a0c81d] text-[#F6F1E7] font-black uppercase tracking-widest hover:bg-[#5C7A12] transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(160,200,29,0.28)] hover:scale-105 active:scale-95"
                    >
                        <Sparkles className="w-5 h-5" /> Skapa veckomeny
                    </button>
                </div>
            </div>
        )}

        {/* === STEP 2: FINE TUNING === */}
        {step === 2 && (
            <div className="flex flex-col h-full min-h-[600px]">
                {isGenerating ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12">
                        <div className="relative mb-8">
                            <div className="w-24 h-24 border-4 border-slate-800 border-t-[#a0c81d] rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center"><LoadingIcon className="w-8 h-8 text-[#a0c81d] animate-pulse" /></div>
                        </div>
                        <h3 className="text-2xl font-black text-[#3D3D3D] mb-2 animate-pulse text-center">{LOADING_STATES[loadingIndex].text}</h3>
                    </div>
                ) : currentPlan ? (
                    <div className="flex-1 flex flex-col animate-fade-in">
                        {/* Sticky Header */}
                        <div className="p-6 border-b border-[#6B6158] bg-[#52574A]/95 backdrop-blur-md sticky top-0 z-30 flex flex-col md:flex-row justify-between items-center gap-4">
                            <button onClick={() => setStep(1)} className="text-white/80 hover:text-[#a0c81d] flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                                <ArrowLeft className="w-4 h-4" /> Ändra Val
                            </button>
                            
                            <div className="text-center">
                                <h2 className="text-lg font-black text-white uppercase tracking-wide">Granska Förslag</h2>
                                <p className="text-[10px] text-white/70 font-bold uppercase">{request.targets.kcal} kcal • {request.diet.type}</p>
                            </div>

                            <button 
                                onClick={handleFinalizeAndPrint}
                                className="bg-[#a0c81d] text-[#F6F1E7] px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#5C7A12] transition-all flex items-center gap-2 shadow-lg shadow-[#a0c81d]/20"
                            >
                                Slutför & Skapa PDF <CheckCircle2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Meal List */}
                        <div className="p-6 md:p-8 space-y-8 flex-1">
                            {currentPlan.map((dayPlan, idx) => (
                                <div key={idx} className="relative pl-6 border-l-2 border-[#DAD1C5]">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 bg-[#F4F0E6] border-2 border-[#a0c81d] rounded-full"></div>
                                    <div className="flex justify-between items-baseline mb-4 gap-3">
                                        <h4 className="text-2xl font-black text-[#3D3D3D] font-heading">{dayPlan.day}</h4>
                                        <span className="text-[10px] bg-[#DAD1C5] text-[#3D3D3D] px-2 py-1 rounded font-bold uppercase">{dayPlan.dailyTotals?.kcal} kcal</span>
                                    </div>
                                    <div className="grid gap-3">
                                        {dayPlan.meals ? (
                                            dayPlan.meals.map((meal: any, mIdx: number) => (
                                                <MealCard 
                                                    key={mIdx}
                                                    type={meal.type} 
                                                    icon={meal.type.toLowerCase().includes('frukost') ? Coffee : meal.type.toLowerCase().includes('lunch') ? Sun : Moon} 
                                                    meal={meal} 
                                                    onClick={() => handleViewRecipe(idx, mIdx)} 
                                                    onSwap={() => handleSwapMeal(idx, meal.type)} 
                                                    isSwapping={swappingMeals[`${idx}-${meal.type}`]} 
                                                />
                                            ))
                                        ) : (
                                            <div className="text-[#8A8177]">Inga måltider.</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <Settings2 className="w-12 h-12 text-[#8A8177] mb-4" />
                        <h3 className="text-xl font-bold text-[#3D3D3D] mb-2">Hoppsan, något gick fel.</h3>
                        <button onClick={() => setStep(1)} className="text-[#a0c81d] underline font-bold uppercase text-xs">Gå tillbaka och försök igen</button>
                    </div>
                )}
            </div>
        )}

        {/* === STEP 3: SUCCESS / GENERATION === */}
        {step === 3 && (
            <div className="flex flex-col items-center justify-center h-full min-h-[500px] p-12 text-center animate-fade-in">
                {isFinalizing ? (
                    <div className="space-y-8">
                        <div className="relative mx-auto w-fit">
                            <div className="w-32 h-32 border-4 border-slate-800 border-t-emerald-500 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center"><Printer className="w-10 h-10 text-emerald-500 animate-pulse" /></div>
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-[#3D3D3D] mb-2">Skapar din Veckoplan</h3>
                            <p className="text-[#6B6158]">Genererar recept, inköpslista och PDF...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in-up">
                        <div className="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_#10b981]">
                            <Check className="w-16 h-16 text-[#F6F1E7]" />
                        </div>
                        <div>
                            <h3 className="text-3xl md:text-4xl font-black text-[#3D3D3D] mb-4">Klart!</h3>
                            <p className="text-[#6B6158] max-w-md mx-auto mb-8">
                                Din veckoplan har skapats och PDF-filen laddas ner.
                                {saveOutcome === 'saved' && ' Du hittar även planen sparad i din profil.'}
                                {saveOutcome === 'skipped' && ' Logga in för att spara veckomenyer i din profil.'}
                                {saveOutcome === 'error' && ' Planen kunde inte sparas – försök gärna igen.'}
                            </p>
                            <div className="flex flex-col md:flex-row gap-4 justify-center">
                                <button onClick={() => navigate('/profile')} className="px-8 py-4 bg-[#F6F1E7] border border-[#E6E1D8] rounded-xl text-[#3D3D3D] font-bold uppercase tracking-widest text-xs hover:bg-[#E8F1D5]">
                                    Gå till Profil
                                </button>
                                <button onClick={() => setStep(1)} className="px-8 py-4 bg-[#a0c81d] text-[#F6F1E7] rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#5C7A12]">
                                    Skapa Ny Plan
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

      </div>

      {/* --- RECEPT MODAL (RESPONSIVE SHEET) --- */}
      {selectedMeal && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center sm:p-4" role="dialog">
          <div 
            className="absolute inset-0 bg-[#F6F1E7]/90 backdrop-blur-md transition-opacity" 
            onClick={() => setSelectedMeal(null)}
          />
          <div className="relative w-full md:max-w-3xl h-[90vh] md:h-[85vh] bg-[#E8F1D5] md:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-[#E6E1D8] animate-fade-in-up">
            
            {/* Header */}
            <div className="bg-[#F6F1E7] p-6 md:p-8 flex justify-between items-start border-b border-[#E6E1D8] shrink-0 relative z-10">
              <div className="pr-8">
                <div className="flex items-center gap-2 mb-2">
                   <span className="bg-[#a0c81d]/10 text-[#a0c81d] text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest border border-[#a0c81d]/20">
                     {selectedMeal.type || "Recept"}
                   </span>
                   {selectedMeal.fullData?.kcal && (
                      <span className="text-[#6B6158] text-[10px] font-bold flex items-center gap-1">
                         <Flame className="w-3 h-3" /> {selectedMeal.fullData.kcal} kcal
                      </span>
                   )}
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-[#3D3D3D] font-heading leading-tight">
                  {selectedMeal.name}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedMeal(null)} 
                className="p-2 bg-[#ffffff]/70 hover:bg-[#ffffff]/95 rounded-full text-[#6B6158] hover:text-[#3D3D3D] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-[#E8F1D5]">
              {recipeLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin text-[#a0c81d]" />
                  <p className="text-[#6B6158] text-sm animate-pulse font-medium">Hämtar recept från AI-kocken...</p>
                </div>
              ) : (
                <div className="max-w-none">
                   <ReactMarkdown components={MarkdownComponents}>
                     {recipeContent || ""}
                   </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-[#E6E1D8] bg-[#F6F1E7] shrink-0 flex justify-between items-center gap-4 safe-area-bottom">
               <div className="hidden md:block text-[10px] text-[#8A8177] font-medium uppercase tracking-widest">
                  AI-genererat innehåll
               </div>
               <button 
                 onClick={() => { if (!userId) { if (window.confirm("Konto krävs. Skapa konto?")) navigate('/auth'); return; } saveRecipeMutation.mutate(); }} 
                 disabled={!recipeContent} 
                 className="w-full md:w-auto bg-[#a0c81d] text-[#F6F1E7] px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-[#a0c81d]/20 transition-all flex items-center justify-center gap-2"
               >
                 <Save className="w-4 h-4" /> Spara till kokbok
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MealCard = ({ type, icon: Icon, meal, onClick, onSwap, isSwapping }: any) => (
  <div onClick={onClick} className="group bg-[#F4F0E6] border border-[#DAD1C5] hover:border-[#a0c81d]/35 rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all hover:bg-[#EAE2D5]">
    <div className="flex items-center gap-4">
      <div className={`p-2 rounded-lg ${type.toLowerCase().includes('frukost') ? 'bg-orange-500/10 text-orange-500' : type.toLowerCase().includes('lunch') ? 'bg-yellow-500/10 text-yellow-500' : 'bg-indigo-500/10 text-indigo-500'}`}><Icon className="w-4 h-4" /></div>
      <div className="min-w-0">
        <span className="text-[9px] font-bold text-[#6B6158] uppercase tracking-widest block mb-0.5">{type}</span>
        <h5 className="text-sm font-bold text-[#3D3D3D] group-hover:text-[#a0c81d] transition-colors line-clamp-1">{meal?.name || "Planeras..."}</h5>
        <div className="text-[10px] text-[#6B6158] font-bold uppercase tracking-widest mt-1">{macroLine(meal)}</div>
      </div>
    </div>
    <div className="flex items-center gap-2">
       {isSwapping ? <RefreshCw className="w-4 h-4 animate-spin text-[#a0c81d]" /> : (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <button onClick={(e) => { e.stopPropagation(); onSwap(); }} className="p-2 hover:bg-[#F6F1E7] rounded-lg text-[#6B6158] hover:text-[#3D3D3D]" title="Byt ut"><RefreshCw className="w-3.5 h-3.5" /></button>
             <button className="p-2 hover:bg-[#F6F1E7] rounded-lg text-[#6B6158] hover:text-[#3D3D3D]"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
       )}
    </div>
  </div>
);

export default WeeklyPlanner;
