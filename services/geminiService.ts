
import { Type } from "@google/genai";

import { supabase } from "../lib/supabase";

// Interfaces
export interface WeeklyPlanRequest {
  language: string;
  days: number;
  servings: number; // Antal personer att laga mat till
  mealsPerDay: number; // Nytt: 3, 4, 5 eller 6 måltider
  targets: { kcal: number; p: number; c: number; f: number }; // p,c,f i procent
  diet: { type: string; allergies: string; excludeIngredients: string; mustInclude: string };
  preferences: {
    categories: string[];
    spiceLevel: string;
    varietyLevel: string;
    leftoversPlan: string;
    optimizeShopping: boolean;
  };
}

const GEMINI_ENDPOINT = '/api/gemini';

const expectedMealTypes = (mealsPerDay: number): string[] => {
  if (mealsPerDay === 3) return ['Frukost', 'Lunch', 'Middag'];
  if (mealsPerDay === 4) return ['Frukost', 'Lunch', 'Mellanmål', 'Middag'];
  if (mealsPerDay === 5) return ['Frukost', 'Mellanmål 1', 'Lunch', 'Mellanmål 2', 'Middag'];
  return ['Frukost', 'Mellanmål 1', 'Lunch', 'Mellanmål 2', 'Middag', 'Kvällsmål'];
};

const buildDietConstraintsBlock = (request: WeeklyPlanRequest): string => `
    ALLERGIER OCH BEGRÄNSNINGAR (MÅSTE FÖLJAS):
    - Allergier: ${request.diet.allergies || 'Inga'}
    - Uteslut ingredienser: ${request.diet.excludeIngredients || 'Inga'}
    - Måste inkludera: ${request.diet.mustInclude || 'Inget'}
    - Portioner: ${request.servings}
`;

const hasExactMealCount = (days: any[], mealsPerDay: number) => (
  Array.isArray(days) &&
  days.every((day) => Array.isArray(day?.meals) && day.meals.length === mealsPerDay)
);

const safeJsonParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};

const computeTotalsFromMeals = (meals: any[]) => meals.reduce((acc, meal) => ({
  kcal: acc.kcal + toNum(meal?.kcal, 0),
  protein: acc.protein + toNum(meal?.protein, 0),
  carbs: acc.carbs + toNum(meal?.carbs, 0),
  fat: acc.fat + toNum(meal?.fat, 0),
}), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

const callGemini = async (contents: string, config?: any): Promise<string> => {
  const { data } = await supabase.auth.getSession();
  const accessToken = data?.session?.access_token;
  if (!accessToken) {
    throw new Error('Ingen aktiv session — logga in igen.');
  }

  const res = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ contents, config })
  });
  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }
  const payloadData = await res.json();
  return payloadData?.text || "";
};

// --- RECIPE GENERATION ---
const generateRecipe = async (title: string, description: string, tags: string[]): Promise<string> => {
  const prompt = `
    Skapa ett detaljerat recept för "${title}".
    Beskrivning: ${description}
    Taggar: ${tags.join(', ')}
    Format: Markdown. Inkludera Ingredienser, Instruktioner (steg-för-steg), och Näringsvärde per portion.
  `;

  const text = await callGemini(prompt);
  return text || "Kunde inte generera recept.";
};

export const generateFullRecipe = async (title: string, context: string, tags?: string[], allergies?: string): Promise<string> => {
    return generateRecipe(title, context + (allergies ? ` Allergier: ${allergies}` : ''), tags || []);
}

// --- WEEKLY PLANNER HELPERS ---

const unwrapWeeklyMeal = (meal: any) =>
  meal && typeof meal === "object" && "data" in meal ? (meal as any).data : meal;

const toNum = (v: any, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeWeeklyMeal = (meal: any) => {
  const m = unwrapWeeklyMeal(meal);
  if (!m) return { name: "Förslag saknas", type: "Måltid", kcal: 0, protein: 0, carbs: 0, fat: 0 };
  
  // Fallback for name if missing in diverse ways
  const name = String((m as any).name || (m as any).title || (m as any).dish || "Maträtt");
  const type = String((m as any).type || "Måltid");
  const kcal = toNum((m as any).kcal ?? (m as any).calories ?? (m as any).energi, 0);
  const protein = toNum((m as any).protein ?? (m as any).p ?? (m as any).proteinGrams, 0);
  const carbs = toNum((m as any).carbs ?? (m as any).c ?? (m as any).kolhydrater, 0);
  const fat = toNum((m as any).fat ?? (m as any).f ?? (m as any).fett, 0);

  return { ...(m as any), name, type, kcal, protein, carbs, fat };
};

const createMealPlaceholder = (type: string) => ({
  type,
  name: `${type} (förslag saknas)`,
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
});

const normalizeWeeklyDay = (day: any, idx: number, expectedTypes: string[] = []) => {
  const d = day || {};
  const rawMeals = Array.isArray(d.meals) ? d.meals : [];

  const baseMeals = rawMeals.map((m: any) => normalizeWeeklyMeal(m));
  const meals = expectedTypes.length > 0
    ? expectedTypes.map((type, mealIdx) => {
      const existing = baseMeals[mealIdx];
      if (!existing) return createMealPlaceholder(type);
      return {
        ...existing,
        type,
        name: existing.name && existing.name !== 'Maträtt' ? existing.name : `${type} (förslag saknas)`,
      };
    })
    : baseMeals;

  const fallbackTotals = computeTotalsFromMeals(meals);
  const explicitTotals = (d as any).dailyTotals || {};

  return {
    ...(d as any),
    day: (d as any).day || `Dag ${idx + 1}`,
    dailyTotals: {
      kcal: toNum(explicitTotals.kcal, fallbackTotals.kcal),
      protein: toNum(explicitTotals.protein, fallbackTotals.protein),
      carbs: toNum(explicitTotals.carbs, fallbackTotals.carbs),
      fat: toNum(explicitTotals.fat, fallbackTotals.fat),
    },
    meals: meals
  };
};

const mergeWeeklyMeal = (overviewMeal: any, detailsMeal: any) => {
  const o = normalizeWeeklyMeal(overviewMeal);
  const detRaw = unwrapWeeklyMeal(detailsMeal);
  const det = normalizeWeeklyMeal(detRaw);
  return {
    ...o,
    ...(detRaw && typeof detRaw === "object" ? detRaw : {}),
    name: o.name && o.name !== "Maträtt" ? o.name : det.name,
    kcal: o.kcal || det.kcal || 0,
    protein: o.protein || det.protein || 0,
    carbs: o.carbs || det.carbs || 0,
    fat: o.fat || det.fat || 0,
  };
};

// --- WEEKLY PLANNER ---

export const generateWeeklyPlan = async (request: WeeklyPlanRequest): Promise<any[]> => {
  const expectedTypes = expectedMealTypes(request.mealsPerDay);
  const varietyLabel =
    request.preferences.varietyLevel === 'low'
      ? 'Låg'
      : request.preferences.varietyLevel === 'high'
        ? 'Hög'
        : 'Balanserad';
  const leftoversLabel =
    request.preferences.leftoversPlan === 'none'
      ? 'Ingen'
      : request.preferences.leftoversPlan === 'high'
        ? 'Mycket'
        : 'Viss';
  
  // Logic to create a realistic calorie distribution string based on meal count
  let distributionInstruction = "";
  if (request.mealsPerDay === 3) {
      distributionInstruction = "Frukost (ca 25%), Lunch (ca 35%), Middag (ca 40%)";
  } else if (request.mealsPerDay === 4) {
      distributionInstruction = "Frukost (ca 25%), Lunch (ca 35%), Mellanmål (ca 10%), Middag (ca 30%)";
  } else if (request.mealsPerDay === 5) {
      distributionInstruction = "Frukost (ca 20%), Mellanmål (ca 10%), Lunch (ca 30%), Mellanmål (ca 10%), Middag (ca 30%)";
  } else {
      distributionInstruction = "Fördela jämnt men låt huvudmålen vara större än mellanmålen.";
  }

  const basePrompt = `
    Skapa en veckomatsedel (${request.days} dagar).
    
    KONFIGURATION:
    - Antal måltider per dag: ${request.mealsPerDay}
    - Totalt energimål per dag: ${request.targets.kcal} kcal
    - Kosthållning: ${request.diet.type}
${buildDietConstraintsBlock(request)}
    - Matstil: ${request.preferences.categories.join(', ') || "Ingen"}
    - Kryddnivå: ${request.preferences.spiceLevel}
    - Variation: ${varietyLabel}
    - Restplanering: ${leftoversLabel}
    - Optimera inköp: ${request.preferences.optimizeShopping ? "Ja" : "Nej"}
    - Ingredienser för: ${request.servings} personer.

    STRUKTUR:
    Om 3 måltider: Frukost, Lunch, Middag.
    Om 4 måltider: Frukost, Lunch, Mellanmål, Middag.
    Om 5 måltider: Frukost, Mellanmål, Lunch, Mellanmål, Middag.
    Om 6 måltider: Frukost, Mellanmål, Lunch, Mellanmål, Middag, Kvällsmål.
    
    KALORIFÖRDELNING (VIKTIGT):
    Dela INTE totalen rakt av. Använd denna fördelning som riktlinje:
    ${distributionInstruction}
    
    Ett mellanmål ska ha BETYDLIGT färre kalorier än en middag.
    Varje måltid MÅSTE ha ett realistiskt kaloriinnehåll baserat på ingredienserna, inte bara ett snittvärde.

    INSTRUKTIONER:
    1. Du SKA generera en array med ${request.days} dagar.
    2. Varje dag ska innehålla en array "meals" med exakt ${request.mealsPerDay} objekt.
    3. Varje måltid MÅSTE ha ett "name" (namn på rätten) och "type" (t.ex. "Frukost", "Lunch").
    4. Försök att matcha makrofördelningen (P/K/F) så gott det går genom val av råvaror.
    
    VIKTIGT: Returnera endast en JSON-array med exakt ${request.days} dagar. Inga förklaringar.
  `;

  // Define schema for a single meal
  const mealSchema = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, description: "Typ av måltid (Frukost, Lunch, etc)" },
        name: { type: Type.STRING, description: "Namn på maträtten" },
        kcal: { type: Type.NUMBER },
        protein: { type: Type.NUMBER },
        carbs: { type: Type.NUMBER },
        fat: { type: Type.NUMBER }
    },
    required: ["name", "type", "kcal"]
  };

  const requestConfig = {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          dailyTotals: { 
              type: Type.OBJECT, 
              properties: { kcal: {type: Type.NUMBER}, protein: {type: Type.NUMBER}, carbs: {type: Type.NUMBER}, fat: {type: Type.NUMBER} } 
          },
          meals: {
              type: Type.ARRAY,
              items: mealSchema
          }
        },
        required: ["day", "meals"]
      }
    }
  } as const;

  const callModel = async (prompt: string) => {
    const text = await callGemini(prompt, requestConfig);
    const parsed = safeJsonParse(text || "[]");
    return Array.isArray(parsed) ? parsed : [];
  };

  let arr = await callModel(basePrompt);
  const hasCorrectDays = arr.length === request.days;
  const hasCorrectMeals = hasExactMealCount(arr, request.mealsPerDay);
  if (!hasCorrectDays || !hasCorrectMeals) {
    console.warn(
      `Weekly plan shape mismatch. days=${arr.length}/${request.days}, exactMeals=${hasCorrectMeals}. Retrying once.`,
    );
    const retryPrompt = `${basePrompt}

OBS:
- Din senaste output hade ${arr.length} dagar (krav: ${request.days}).
- Varje dag måste ha exakt ${request.mealsPerDay} måltider.
- Följ exakt denna ordning: ${expectedTypes.join(', ')}.`;
    const retryArr = await callModel(retryPrompt);
    if (retryArr.length === request.days && hasExactMealCount(retryArr, request.mealsPerDay)) {
      arr = retryArr;
    }
  }

  return Array.from({ length: request.days }, (_, idx) => normalizeWeeklyDay(arr[idx], idx, expectedTypes));
};

export const generateFullWeeklyDetails = async (
  planOverview: any[],
  requestLike: Partial<WeeklyPlanRequest> | Record<string, any> = {},
): Promise<any[]> => {
  const mealsPerDay = Number((requestLike as WeeklyPlanRequest)?.mealsPerDay || 0);
  const expectedTypes = mealsPerDay >= 3 ? expectedMealTypes(mealsPerDay) : [];
  const reqDiet = (requestLike as WeeklyPlanRequest)?.diet || { type: '', allergies: '', excludeIngredients: '', mustInclude: '' };
  const reqServings = Number((requestLike as WeeklyPlanRequest)?.servings || 0) || 1;
  const reqOptimize = Boolean((requestLike as WeeklyPlanRequest)?.preferences?.optimizeShopping);

  const overview = Array.isArray(planOverview) ? planOverview : [];
  const overviewNormalized = overview.map((d: any, idx: number) => normalizeWeeklyDay(d, idx, expectedTypes));

  const planStr = JSON.stringify(overviewNormalized);
  const prompt = `
    Baserat på denna översikt, generera detaljerade ingredienslistor och korta instruktioner för varje måltid.
    Plan: ${planStr}

    ALLERGIER OCH BEGRÄNSNINGAR (MÅSTE FÖLJAS):
    - Allergier: ${reqDiet.allergies || 'Inga'}
    - Uteslut ingredienser: ${reqDiet.excludeIngredients || 'Inga'}
    - Måste inkludera: ${reqDiet.mustInclude || 'Inget'}
    - Kosthållning: ${reqDiet.type || 'Ingen särskild'}
    - Portioner: ${reqServings}
    - Optimera inköp: ${reqOptimize ? 'Ja' : 'Nej'}

    VIKTIGT: Varje ingrediens MÅSTE ha mängd och enhet (t.ex. \"150 g kyckling\", \"2 dl ris\", \"1 msk olivolja\").
    Inkludera alltid mängder per råvara och håll det realistiskt för antal portioner.

    Output JSON format: Array of Days. Each day has a 'meals' array corresponding to the input. Add ingredients and instructions to each meal.
  `;

  const detailsText = await callGemini(prompt, {
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          meals: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                ingredients: { type: Type.ARRAY, items: { type: Type.STRING, description: "Ingrediens med mängd och enhet" } },
                instructions: { type: Type.STRING }
              },
              required: ['name', 'type', 'ingredients', 'instructions']
            }
          }
        },
        required: ['meals']
      }
    }
  });

  const parsed = safeJsonParse(detailsText || "[]");
  const details = Array.isArray(parsed) ? parsed : [];

  return overviewNormalized.map((oDay: any, idx: number) => {
    const dDay = details[idx] || {};
    // Merge meal arrays by index
    const mergedMeals = (oDay.meals || []).map((oMeal: any, mIdx: number) => {
        const dMeal = dDay.meals?.[mIdx] || {};
        const merged = mergeWeeklyMeal(oMeal, dMeal);
        return {
          ...merged,
          ingredients: Array.isArray(merged.ingredients)
            ? merged.ingredients
            : Array.isArray(dMeal.ingredients)
              ? dMeal.ingredients
              : ['Mängdangivelser saknas - komplettera manuellt.'],
          instructions: merged.instructions || dMeal.instructions || 'Instruktion saknas - komplettera manuellt.'
        };
    });

    return {
      ...oDay,
      day: oDay.day || dDay.day || `Dag ${idx + 1}`,
      dailyTotals: oDay.dailyTotals || dDay.dailyTotals || computeTotalsFromMeals(mergedMeals),
      meals: mergedMeals
    };
  });
};

export const swapMeal = async (currentMealName: string, mealType: string, request: WeeklyPlanRequest): Promise<any> => {
    // Determine realistic calories based on meal type for the swap
    let targetKcal = Math.round(request.targets.kcal / request.mealsPerDay); // Default average
    
    const lowerType = mealType.toLowerCase();
    if (lowerType.includes('mellan') || lowerType.includes('snack')) {
        targetKcal = Math.round(request.targets.kcal * 0.10); // ~10% for snacks
    } else if (lowerType.includes('frukost')) {
        targetKcal = Math.round(request.targets.kcal * 0.25); // ~25% for breakfast
    } else if (lowerType.includes('lunch') || lowerType.includes('middag')) {
        targetKcal = Math.round(request.targets.kcal * 0.35); // ~35% for main meals
    }

    const prompt = `
      Byt ut maträtten "${currentMealName}" (${mealType}) mot något annat som passar:
      Diet: ${request.diet.type}
      Allergier: ${request.diet.allergies || 'Inga'}
      Uteslut ingredienser: ${request.diet.excludeIngredients || 'Inga'}
      Måste inkludera: ${request.diet.mustInclude || 'Inget'}
      Portioner: ${request.servings}
      Målkalorier för denna måltid: ca ${targetKcal} kcal (Var realistisk, dela inte bara totalen).
      Makromål: P ${request.targets.p}%, K ${request.targets.c}%, F ${request.targets.f}%
      
      Ge mig det nya förslaget som JSON. Namn är obligatoriskt.
    `;
    
    const swapText = await callGemini(prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT, 
        properties: { 
            name: {type: Type.STRING}, 
            type: {type: Type.STRING},
            kcal: {type: Type.NUMBER}, 
            protein: {type: Type.NUMBER}, 
            carbs: {type: Type.NUMBER}, 
            fat: {type: Type.NUMBER} 
        },
        required: ["name"]
      }
    });
    
    const res = safeJsonParse(swapText || "{}");
    const normalized = normalizeWeeklyMeal(res);
    if (!normalized.type || normalized.type === 'Måltid') {
      return { ...normalized, type: mealType };
    }
    return normalized;
};
