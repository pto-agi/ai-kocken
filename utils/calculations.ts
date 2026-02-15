
import { UserData, CalculationResult, Gender, Goal, MealPlan } from '../types';
import { ACTIVITY_MULTIPLIERS } from '../constants';

export const calculateBMR = (data: UserData): number => {
  // Mifflin-St Jeor Equation
  const s = data.gender === Gender.MALE ? 5 : -161;
  const bmr = (10 * data.weight) + (6.25 * data.height) - (5 * data.age) + s;
  return Math.round(bmr);
};

const distributePortions = (total: number, weights: number[]): number[] => {
  // Simple algorithm to distribute integer portions according to weights (approximate)
  let distributed = weights.map(w => Math.floor(total * w));
  let currentSum = distributed.reduce((a, b) => a + b, 0);
  let remainder = total - currentSum;
  
  // Add remainder to largest meals first (usually Lunch/Dinner)
  let i = 0;
  while (remainder > 0) {
    // Bias towards index 2 (Lunch) and 4 (Dinner)
    if (i === 2 || i === 4) {
      distributed[i]++;
      remainder--;
    } else if (remainder > 0) {
      distributed[i]++;
      remainder--;
    }
    i = (i + 1) % weights.length;
  }
  return distributed;
};

export const calculateMealPlan = (targetCalories: number, splits: {p: number, c: number, f: number}): MealPlan => {
  // 1 Portion (P) = 100 kcal approx
  const totalPortions = Math.round(targetCalories / 100);
  
  // Calculate raw portion counts based on macro split
  const pPortions = Math.round(totalPortions * splits.p);
  const cPortions = Math.round(totalPortions * splits.c);
  const fPortions = Math.round(totalPortions * splits.f);

  // Distribution weights (Breakfast, Snack1, Lunch, Snack2, Dinner)
  // Approx: 20%, 10%, 30%, 10%, 30%
  const mealWeights = [0.2, 0.1, 0.3, 0.1, 0.3];

  const pDist = distributePortions(pPortions, mealWeights);
  const cDist = distributePortions(cPortions, mealWeights);
  const fDist = distributePortions(fPortions, mealWeights);

  return {
    totalPortions: { protein: pPortions, carbs: cPortions, fats: fPortions },
    breakfast: { protein: pDist[0], carbs: cDist[0], fats: fDist[0] },
    snack1: { protein: pDist[1], carbs: cDist[1], fats: fDist[1] },
    lunch: { protein: pDist[2], carbs: cDist[2], fats: fDist[2] },
    snack2: { protein: pDist[3], carbs: cDist[3], fats: fDist[3] },
    dinner: { protein: pDist[4], carbs: cDist[4], fats: fDist[4] },
  };
};

export const calculateEnergyData = (data: UserData): CalculationResult => {
  const bmr = calculateBMR(data);
  const tdee = Math.round(bmr * ACTIVITY_MULTIPLIERS[data.activityLevel]);
  
  let targetCalories = tdee;
  
  switch (data.goal) {
    case Goal.LOSE_WEIGHT:
      targetCalories = tdee - 500;
      break;
    case Goal.GAIN_MUSCLE:
      targetCalories = tdee + 300;
      break;
    case Goal.MAINTAIN:
    default:
      targetCalories = tdee;
      break;
  }

  // Determine Macro Split
  let macroSplit = { p: 0.35, c: 0.35, f: 0.30 }; // Default

  if (data.useCustomMacros && data.macroSplit) {
    macroSplit = {
      p: data.macroSplit.protein / 100,
      c: data.macroSplit.carbs / 100,
      f: data.macroSplit.fats / 100
    };
  }
  
  const proteinCals = targetCalories * macroSplit.p;
  const carbsCals = targetCalories * macroSplit.c;
  const fatCals = targetCalories * macroSplit.f;

  const mealPlan = calculateMealPlan(targetCalories, macroSplit);

  return {
    bmr,
    tdee,
    targetCalories,
    dailyProtein: Math.round(proteinCals / 4),
    dailyCarbs: Math.round(carbsCals / 4),
    dailyFats: Math.round(fatCals / 9),
    mealPlan
  };
};