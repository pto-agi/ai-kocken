
import { GoogleGenAI, Type } from "@google/genai";
import { getEnv } from "../lib/env";

// Initialize Gemini
const apiKey = getEnv('VITE_GEMINI_API_KEY');
const ai = new GoogleGenAI({ apiKey });

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
    budgetLevel: string;
    mealPrepLevel: string;
    maxCookTimeMin: number;
    optimizeShopping: boolean;
  };
}

// Model Configuration
const RECIPE_MODEL = 'gemini-2.5-flash-preview-09-2025'; // Using latest flash for speed

// --- RECIPE GENERATION ---
export const generateRecipe = async (title: string, description: string, tags: string[]): Promise<string> => {
  const prompt = `
    Skapa ett detaljerat recept för "${title}".
    Beskrivning: ${description}
    Taggar: ${tags.join(', ')}
    Format: Markdown. Inkludera Ingredienser, Instruktioner (steg-för-steg), och Näringsvärde per portion.
  `;

  const response = await ai.models.generateContent({
    model: RECIPE_MODEL,
    contents: prompt,
  });

  return response.text || "Kunde inte generera recept.";
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

const normalizeWeeklyDay = (day: any, idx: number) => {
  const d = day || {};
  const rawMeals = Array.isArray(d.meals) ? d.meals : [];
  
  // Map dynamic meals
  const meals = rawMeals.map((m: any) => normalizeWeeklyMeal(m));

  return {
    ...(d as any),
    day: (d as any).day || `Dag ${idx + 1}`,
    dailyTotals: (d as any).dailyTotals || {
      kcal: toNum((d as any)?.dailyTotals?.kcal, 0),
      protein: toNum((d as any)?.dailyTotals?.protein, 0),
      carbs: toNum((d as any)?.dailyTotals?.carbs, 0),
      fat: toNum((d as any)?.dailyTotals?.fat, 0),
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

  const prompt = `
    Skapa en veckomatsedel (${request.days} dagar).
    
    KONFIGURATION:
    - Antal måltider per dag: ${request.mealsPerDay}
    - Totalt energimål per dag: ${request.targets.kcal} kcal
    - Kosthållning: ${request.diet.type}
    - Allergier (VIKTIGT): ${request.diet.allergies || "Inga"}
    - Uteslut ingredienser (VIKTIGT): ${request.diet.excludeIngredients || "Inga"}
    - Måste inkludera: ${request.diet.mustInclude || "Inget"}
    - Preferenser: ${request.preferences.categories.join(', ')}
    - Kryddnivå: ${request.preferences.spiceLevel}
    - Budgetnivå: ${request.preferences.budgetLevel}
    - Meal prep: ${request.preferences.mealPrepLevel}
    - Max tillagningstid: ${request.preferences.maxCookTimeMin} minuter
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
    
    VIKTIGT: Returnera endast en JSON-array.
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

  const response = await ai.models.generateContent({
    model: RECIPE_MODEL,
    contents: prompt,
    config: {
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
    }
  });

  const parsed = JSON.parse(response.text || "[]");
  const arr = Array.isArray(parsed) ? parsed : [];
  return arr.map((d: any, idx: number) => normalizeWeeklyDay(d, idx));
};

export const generateFullWeeklyDetails = async (planOverview: any[], targets: any): Promise<any[]> => {
  const overview = Array.isArray(planOverview) ? planOverview : [];
  const overviewNormalized = overview.map((d: any, idx: number) => normalizeWeeklyDay(d, idx));

  const planStr = JSON.stringify(overviewNormalized);
  const prompt = `
    Baserat på denna översikt, generera detaljerade ingredienslistor och korta instruktioner för varje måltid.
    Plan: ${planStr}

    VIKTIGT: Varje ingrediens MÅSTE ha mängd och enhet (t.ex. \"150 g kyckling\", \"2 dl ris\", \"1 msk olivolja\").
    Inkludera alltid mängder per råvara och håll det realistiskt för antal portioner.

    Output JSON format: Array of Days. Each day has a 'meals' array corresponding to the input. Add ingredients and instructions to each meal.
  `;

  const response = await ai.models.generateContent({
    model: RECIPE_MODEL,
    contents: prompt,
    config: {
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
                }
              }
            }
          }
        }
      }
    },
  });

  const parsed = JSON.parse(response.text || "[]");
  const details = Array.isArray(parsed) ? parsed : [];

  return overviewNormalized.map((oDay: any, idx: number) => {
    const dDay = details[idx] || {};
    // Merge meal arrays by index
    const mergedMeals = (oDay.meals || []).map((oMeal: any, mIdx: number) => {
        const dMeal = dDay.meals?.[mIdx] || {};
        const merged = mergeWeeklyMeal(oMeal, dMeal);
        return {
          ...merged,
          ingredients: Array.isArray(merged.ingredients) ? merged.ingredients : Array.isArray(dMeal.ingredients) ? dMeal.ingredients : [],
          instructions: merged.instructions || dMeal.instructions || ""
        };
    });

    return {
      ...oDay,
      day: oDay.day || dDay.day || `Dag ${idx + 1}`,
      dailyTotals: oDay.dailyTotals || dDay.dailyTotals,
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
      Målkalorier för denna måltid: ca ${targetKcal} kcal (Var realistisk, dela inte bara totalen).
      Makromål: P ${request.targets.p}%, K ${request.targets.c}%, F ${request.targets.f}%
      
      Ge mig det nya förslaget som JSON. Namn är obligatoriskt.
    `;
    
    const response = await ai.models.generateContent({
        model: RECIPE_MODEL,
        contents: prompt,
        config: {
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
        }
    });
    
    const res = JSON.parse(response.text || "{}");
    // Ensure type is preserved if AI forgets it
    if (!res.type) res.type = mealType;
    return res;
};
