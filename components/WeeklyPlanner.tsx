
import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Loader2, CalendarDays, Printer, Coffee, Sun, Moon, X,
  Save, ArrowRight, Brain, ChefHat, Settings2, AlertTriangle, Minus,
  Plus, Wallet, Leaf, Beef, Fish, Check, Target, ShoppingBasket,
  Users, RefreshCw, List, CheckCircle2, Flame, PieChart, ChevronRight,
  ArrowLeft, FileDown, Utensils
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
  { text: "Matchar rätter efter budget och tidsram...", icon: Wallet },
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
  h1: ({node, ...props}: any) => <h1 className="text-2xl md:text-3xl font-black text-white mb-6 mt-2 font-heading" {...props} />,
  h2: ({node, ...props}: any) => <h2 className="text-lg md:text-xl font-bold text-[#a0c81d] mb-4 mt-8 border-b border-white/10 pb-2 flex items-center gap-2 uppercase tracking-wide" {...props} />, 
  p: ({node, ...props}: any) => <p className="text-slate-300 leading-relaxed mb-4 text-sm md:text-base font-medium" {...props} />,
  ul: ({node, ...props}: any) => <ul className="space-y-3 mb-6 bg-white/5 p-6 rounded-2xl border border-white/5" {...props} />,
  ol: ({node, ...props}: any) => <ol className="space-y-4 mb-6 list-decimal pl-5 text-slate-300" {...props} />,
  li: ({node, ...props}: any) => (
    <li className="flex items-start gap-3 text-slate-300 text-sm md:text-base">
      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#a0c81d] shrink-0" />
      <span className="flex-1">{props.children}</span>
    </li>
  ),
  strong: ({node, ...props}: any) => <strong className="text-white font-black" {...props} />,
  hr: ({node, ...props}: any) => <hr className="border-white/10 my-8" {...props} />
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
      budgetLevel: 'normal',
      mealPrepLevel: 'some',
      maxCookTimeMin: 30,
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
    } catch (e) {
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
        } catch (e) {
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
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            <CalendarDays className="w-3 h-3 text-[#a0c81d]" /> Veckomeny
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-white font-heading tracking-tight mb-2">
          Kalibera kosten <span className="text-[#a0c81d]">efter just dig</span>
        </h1>
        <p className="text-slate-400 font-medium text-sm md:text-base max-w-2xl mx-auto">
          {step === 1 && "Ange antalet kalorier som ditt kostschema ska anpassas samt dina preferenser kring antal mål per dag och kosten i sin helhet."}
          {step === 2 && "Steg 2: Granska och finjustera"}
          {step === 3 && "Steg 3: Genererar slutgiltig plan"}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="max-w-xl mx-auto mb-12">
         <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-[#1e293b] -z-10"></div>
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-[#a0c81d] -z-10 transition-all duration-500`} style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div>
            
            {[1, 2, 3].map(s => (
                <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-4 transition-all duration-300 ${
                    step >= s ? 'bg-[#a0c81d] border-[#0f172a] text-[#0f172a] scale-110 shadow-[0_0_15px_#a0c81d]' : 'bg-[#1e293b] border-[#0f172a] text-slate-500'
                }`}>
                    {s}
                </div>
            ))}
         </div>
         <div className="flex justify-between mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
             <span>Kalibrering</span>
             <span>Finjustering</span>
             <span>Resultat</span>
         </div>
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="bg-[#1e293b] rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden relative min-h-[500px]">
        
        {/* === STEP 1: CALIBRATION === */}
        {step === 1 && (
            <div className="p-8 md:p-12 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    
                    {/* LEFT: VOLUME & TARGETS */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-[#a0c81d]/10 p-2 rounded-xl text-[#a0c81d]"><Target className="w-5 h-5" /></div>
                            <h3 className="text-xl font-black text-white font-heading uppercase tracking-wide">Mål & Volym</h3>
                        </div>

                        <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/5 space-y-6">
                            {/* Calories */}
                            <div>
                                <div className="flex justify-between items-end mb-4">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dagligt Energimål</label>
                                    <span className="text-2xl font-black text-[#a0c81d]">{request.targets.kcal} <span className="text-sm text-slate-400">kcal</span></span>
                                </div>
                                <input 
                                    type="range" min="1200" max="4000" step="50" 
                                    value={request.targets.kcal} 
                                    onChange={(e) => setRequest(p => ({ ...p, targets: { ...p.targets, kcal: Number(e.target.value) } }))} 
                                    className="w-full accent-[#a0c81d] h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer" 
                                />
                            </div>

                            {/* Servings & Meals */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Portioner</label>
                                    <div className="flex items-center justify-between bg-[#1e293b] rounded-xl p-2 border border-white/5">
                                        <button onClick={() => setRequest(p => ({ ...p, servings: Math.max(1, p.servings - 1) }))} className="w-8 h-8 flex items-center justify-center bg-[#0f172a] rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><Minus className="w-4 h-4" /></button>
                                        <span className="font-black text-white">{request.servings}</span>
                                        <button onClick={() => setRequest(p => ({ ...p, servings: Math.min(12, p.servings + 1) }))} className="w-8 h-8 flex items-center justify-center bg-[#0f172a] rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><Plus className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Måltider / Dag</label>
                                    <div className="flex items-center justify-between bg-[#1e293b] rounded-xl p-2 border border-white/5">
                                        <button onClick={() => setRequest(p => ({ ...p, mealsPerDay: Math.max(3, p.mealsPerDay - 1) }))} className="w-8 h-8 flex items-center justify-center bg-[#0f172a] rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><Minus className="w-4 h-4" /></button>
                                        <span className="font-black text-white">{request.mealsPerDay}</span>
                                        <button onClick={() => setRequest(p => ({ ...p, mealsPerDay: Math.min(6, p.mealsPerDay + 1) }))} className="w-8 h-8 flex items-center justify-center bg-[#0f172a] rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><Plus className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Diet Type - Updated to Pills */}
                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Kosthållning</label>
                            <div className="flex flex-wrap gap-2">
                                {DIET_TYPES.map(diet => (
                                    <button 
                                        key={diet.id} 
                                        onClick={() => setRequest(p => ({ ...p, diet: { ...p.diet, type: diet.id } }))}
                                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                                            request.diet.type === diet.id 
                                            ? 'bg-[#a0c81d] text-[#0f172a] border-[#a0c81d]' 
                                            : 'bg-[#0f172a] text-slate-400 border-white/10 hover:border-white/20'
                                        }`}
                                    >
                                        <diet.icon className="w-3.5 h-3.5" />
                                        {diet.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: MACROS & PREFS */}
                    <div className="space-y-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-purple-500/10 p-2 rounded-xl text-purple-400"><PieChart className="w-5 h-5" /></div>
                            <h3 className="text-xl font-black text-white font-heading uppercase tracking-wide">Makro & Preferens</h3>
                        </div>

                        <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/5 space-y-6">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Välj Inriktning</label>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${isMacroSumValid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
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
                                            ? 'bg-[#a0c81d] text-[#0f172a] border-[#a0c81d]' 
                                            : 'bg-[#1e293b] text-slate-400 border-white/5 hover:border-white/20'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4 pt-2 border-t border-white/5">
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-2">
                                        <span className="text-emerald-400 uppercase tracking-wider">Protein</span>
                                        <span className="text-white">{request.targets.p}%</span>
                                    </div>
                                    <input 
                                      type="range" min="0" max="100" step="5" 
                                      value={request.targets.p} 
                                      onChange={(e) => setRequest(p => ({ ...p, targets: { ...p.targets, p: Number(e.target.value) } }))} 
                                      className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" 
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-2">
                                        <span className="text-blue-400 uppercase tracking-wider">Kolhydrater</span>
                                        <span className="text-white">{request.targets.c}%</span>
                                    </div>
                                    <input 
                                      type="range" min="0" max="100" step="5" 
                                      value={request.targets.c} 
                                      onChange={(e) => setRequest(p => ({ ...p, targets: { ...p.targets, c: Number(e.target.value) } }))} 
                                      className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" 
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs font-bold mb-2">
                                        <span className="text-amber-400 uppercase tracking-wider">Fett</span>
                                        <span className="text-white">{request.targets.f}%</span>
                                    </div>
                                    <input 
                                      type="range" min="0" max="100" step="5" 
                                      value={request.targets.f} 
                                      onChange={(e) => setRequest(p => ({ ...p, targets: { ...p.targets, f: Number(e.target.value) } }))} 
                                      className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" 
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3 flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> Allergier & Undantag</label>
                            <input 
                                type="text" 
                                value={request.diet.allergies} 
                                onChange={(e) => setRequest(p => ({ ...p, diet: { ...p.diet, allergies: e.target.value } }))}
                                placeholder="T.ex. Nötter, Gluten, Koriander..." 
                                className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium" 
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Uteslut Ingredienser</label>
                                <input
                                    type="text"
                                    value={request.diet.excludeIngredients}
                                    onChange={(e) => setRequest(p => ({ ...p, diet: { ...p.diet, excludeIngredients: e.target.value } }))}
                                    placeholder="T.ex. Svamp, Koriander..."
                                    className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">Måste Inkludera</label>
                                <input
                                    type="text"
                                    value={request.diet.mustInclude}
                                    onChange={(e) => setRequest(p => ({ ...p, diet: { ...p.diet, mustInclude: e.target.value } }))}
                                    placeholder="T.ex. Lax, Kyckling..."
                                    className="w-full bg-[#0f172a] border border-white/10 rounded-xl px-4 py-4 text-sm text-white focus:border-[#a0c81d] outline-none placeholder-slate-600 font-medium"
                                />
                            </div>
                        </div>

                        <div className="bg-[#0f172a] p-6 rounded-2xl border border-white/5 space-y-5">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Max Tillagningstid</label>
                                <span className="text-xs font-black text-[#a0c81d]">{request.preferences.maxCookTimeMin} min</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="120"
                                step="5"
                                value={request.preferences.maxCookTimeMin}
                                onChange={(e) => setRequest(p => ({ ...p, preferences: { ...p.preferences, maxCookTimeMin: Number(e.target.value) } }))}
                                className="w-full accent-[#a0c81d] h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Kryddnivå</label>
                                    <select
                                        value={request.preferences.spiceLevel}
                                        onChange={(e) => setRequest(p => ({ ...p, preferences: { ...p.preferences, spiceLevel: e.target.value } }))}
                                        className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-3 py-3 text-xs text-white font-bold uppercase"
                                    >
                                        <option value="mild">Mild</option>
                                        <option value="medium">Medium</option>
                                        <option value="hot">Stark</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Budget</label>
                                    <select
                                        value={request.preferences.budgetLevel}
                                        onChange={(e) => setRequest(p => ({ ...p, preferences: { ...p.preferences, budgetLevel: e.target.value } }))}
                                        className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-3 py-3 text-xs text-white font-bold uppercase"
                                    >
                                        <option value="budget">Budget</option>
                                        <option value="normal">Normal</option>
                                        <option value="premium">Premium</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Meal Prep</label>
                                    <select
                                        value={request.preferences.mealPrepLevel}
                                        onChange={(e) => setRequest(p => ({ ...p, preferences: { ...p.preferences, mealPrepLevel: e.target.value } }))}
                                        className="w-full bg-[#1e293b] border border-white/10 rounded-xl px-3 py-3 text-xs text-white font-bold uppercase"
                                    >
                                        <option value="low">Låg</option>
                                        <option value="some">Medel</option>
                                        <option value="high">Hög</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Optimera Inköp</label>
                                <button
                                    onClick={() => setRequest(p => ({ ...p, preferences: { ...p.preferences, optimizeShopping: !p.preferences.optimizeShopping } }))}
                                    role="switch"
                                    aria-checked={request.preferences.optimizeShopping}
                                    className={`w-12 h-7 rounded-full p-1 transition-colors ${request.preferences.optimizeShopping ? 'bg-[#a0c81d]' : 'bg-slate-700'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${request.preferences.optimizeShopping ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-white/5 flex justify-center">
                    <button 
                        onClick={handleGenerateDraft} 
                        className="w-full md:w-auto px-12 py-5 rounded-2xl bg-[#a0c81d] text-[#0f172a] font-black uppercase tracking-widest hover:bg-[#b5e02e] transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(160,200,29,0.3)] hover:scale-105 active:scale-95"
                    >
                        <Sparkles className="w-5 h-5" /> Generera Utkast
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
                        <h3 className="text-2xl font-black text-white mb-2 animate-pulse text-center">{LOADING_STATES[loadingIndex].text}</h3>
                    </div>
                ) : currentPlan ? (
                    <div className="flex-1 flex flex-col animate-fade-in">
                        {/* Sticky Header */}
                        <div className="p-6 border-b border-white/5 bg-[#1e293b]/95 backdrop-blur-md sticky top-0 z-30 flex flex-col md:flex-row justify-between items-center gap-4">
                            <button onClick={() => setStep(1)} className="text-slate-400 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                                <ArrowLeft className="w-4 h-4" /> Ändra Val
                            </button>
                            
                            <div className="text-center">
                                <h2 className="text-lg font-black text-white uppercase tracking-wide">Granska Förslag</h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase">{request.targets.kcal} kcal • {request.diet.type}</p>
                            </div>

                            <button 
                                onClick={handleFinalizeAndPrint}
                                className="bg-[#a0c81d] text-[#0f172a] px-6 py-3 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-[#b5e02e] transition-all flex items-center gap-2 shadow-lg shadow-[#a0c81d]/20"
                            >
                                Slutför & Skapa PDF <CheckCircle2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Meal List */}
                        <div className="p-6 md:p-8 space-y-8 flex-1">
                            {currentPlan.map((dayPlan, idx) => (
                                <div key={idx} className="relative pl-6 border-l-2 border-white/5">
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 bg-[#1e293b] border-2 border-[#a0c81d] rounded-full"></div>
                                    <div className="flex justify-between items-baseline mb-4 gap-3">
                                        <h4 className="text-2xl font-black text-white font-heading">{dayPlan.day}</h4>
                                        <span className="text-[10px] bg-black/20 text-slate-500 px-2 py-1 rounded font-bold uppercase">{dayPlan.dailyTotals?.kcal} kcal</span>
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
                                            <div className="text-slate-500">Inga måltider.</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <Settings2 className="w-12 h-12 text-slate-600 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Hoppsan, något gick fel.</h3>
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
                            <h3 className="text-2xl font-black text-white mb-2">Skapar din Veckoplan</h3>
                            <p className="text-slate-400">Genererar recept, inköpslista och PDF...</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in-up">
                        <div className="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_#10b981]">
                            <Check className="w-16 h-16 text-[#0f172a]" />
                        </div>
                        <div>
                            <h3 className="text-3xl md:text-4xl font-black text-white mb-4">Klart!</h3>
                            <p className="text-slate-300 max-w-md mx-auto mb-8">
                                Din veckoplan har skapats och PDF-filen laddas ner.
                                {saveOutcome === 'saved' && ' Du hittar även planen sparad i din profil.'}
                                {saveOutcome === 'skipped' && ' Logga in för att spara veckomenyer i din profil.'}
                                {saveOutcome === 'error' && ' Planen kunde inte sparas – försök gärna igen.'}
                            </p>
                            <div className="flex flex-col md:flex-row gap-4 justify-center">
                                <button onClick={() => navigate('/profile')} className="px-8 py-4 bg-[#0f172a] border border-white/10 rounded-xl text-white font-bold uppercase tracking-widest text-xs hover:bg-[#1e293b]">
                                    Gå till Profil
                                </button>
                                <button onClick={() => setStep(1)} className="px-8 py-4 bg-[#a0c81d] text-[#0f172a] rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#b5e02e]">
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
            className="absolute inset-0 bg-[#0f172a]/90 backdrop-blur-md transition-opacity" 
            onClick={() => setSelectedMeal(null)}
          />
          <div className="relative w-full md:max-w-3xl h-[90vh] md:h-[85vh] bg-[#1e293b] md:rounded-[2.5rem] rounded-t-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/10 animate-fade-in-up">
            
            {/* Header */}
            <div className="bg-[#0f172a] p-6 md:p-8 flex justify-between items-start border-b border-white/5 shrink-0 relative z-10">
              <div className="pr-8">
                <div className="flex items-center gap-2 mb-2">
                   <span className="bg-[#a0c81d]/10 text-[#a0c81d] text-[10px] font-black px-2 py-1 rounded uppercase tracking-widest border border-[#a0c81d]/20">
                     {selectedMeal.type || "Recept"}
                   </span>
                   {selectedMeal.fullData?.kcal && (
                      <span className="text-slate-400 text-[10px] font-bold flex items-center gap-1">
                         <Flame className="w-3 h-3" /> {selectedMeal.fullData.kcal} kcal
                      </span>
                   )}
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white font-heading leading-tight">
                  {selectedMeal.name}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedMeal(null)} 
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar bg-[#1e293b]">
              {recipeLoading ? (
                <div className="h-full flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin text-[#a0c81d]" />
                  <p className="text-slate-400 text-sm animate-pulse font-medium">Hämtar recept från AI-kocken...</p>
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
            <div className="p-6 border-t border-white/5 bg-[#0f172a] shrink-0 flex justify-between items-center gap-4 safe-area-bottom">
               <div className="hidden md:block text-[10px] text-slate-500 font-medium uppercase tracking-widest">
                  AI-genererat innehåll
               </div>
               <button 
                 onClick={() => { if (!userId) { if (window.confirm("Konto krävs. Skapa konto?")) navigate('/auth'); return; } saveRecipeMutation.mutate(); }} 
                 disabled={!recipeContent} 
                 className="w-full md:w-auto bg-[#a0c81d] text-[#0f172a] px-8 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#b5e02e] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-[#a0c81d]/20 transition-all flex items-center justify-center gap-2"
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
  <div onClick={onClick} className="group bg-[#0f172a] border border-white/5 hover:border-[#a0c81d]/30 rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all hover:bg-[#152033]">
    <div className="flex items-center gap-4">
      <div className={`p-2 rounded-lg ${type.toLowerCase().includes('frukost') ? 'bg-orange-500/10 text-orange-500' : type.toLowerCase().includes('lunch') ? 'bg-yellow-500/10 text-yellow-500' : 'bg-indigo-500/10 text-indigo-500'}`}><Icon className="w-4 h-4" /></div>
      <div className="min-w-0">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">{type}</span>
        <h5 className="text-sm font-bold text-white group-hover:text-[#a0c81d] transition-colors line-clamp-1">{meal?.name || "Planeras..."}</h5>
        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">{macroLine(meal)}</div>
      </div>
    </div>
    <div className="flex items-center gap-2">
       {isSwapping ? <RefreshCw className="w-4 h-4 animate-spin text-[#a0c81d]" /> : (
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <button onClick={(e) => { e.stopPropagation(); onSwap(); }} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white" title="Byt ut"><RefreshCw className="w-3.5 h-3.5" /></button>
             <button className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
       )}
    </div>
  </div>
);

export default WeeklyPlanner;
