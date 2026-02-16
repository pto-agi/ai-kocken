
// src/types.ts

// --- ENUMS & NAVIGATION ---

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

export enum ActivityLevel {
  SEDENTARY = 'SEDENTARY',
  LIGHTLY_ACTIVE = 'LIGHTLY_ACTIVE',
  MODERATELY_ACTIVE = 'MODERATELY_ACTIVE',
  VERY_ACTIVE = 'VERY_ACTIVE',
  EXTRA_ACTIVE = 'EXTRA_ACTIVE',
}

export enum Goal {
  LOSE_WEIGHT = 'cut',
  MAINTAIN = 'maintain',
  GAIN_MUSCLE = 'bulk',
}

export enum AppRoute {
  HOME = 'home',
  CHEF = 'chef',
  KITCHEN = 'kitchen',
  FOOD_HUB = 'food_hub',
  HEALTH = 'health',
  AUTH = 'auth',
  PROFILE = 'profile',
  COACH = 'coach' 
}

export type ViewState = AppRoute | string;

// --- SMART RECIPE TYPES (GULD-FEATURE) ---

export interface Ingredient {
  item: string;
  amount: string;
  category: string; // "Guld-nyckeln" för sortering (t.ex. "Mejeri", "Grönsaker")
}

export interface SmartRecipeData {
  title: string;
  description: string;
  meta: {
    time: string;
    kcal: number;
    protein: string;
  };
  ingredients: Ingredient[];
  instructions: { 
    step: number; 
    text: string 
  }[];
  healthTip: string;
}

// --- CALCULATOR TYPES ---

export interface MacroSplit {
  protein: number;
  carbs: number;
  fats: number;
}

export interface UserData {
  gender: Gender;
  age: number;
  height: number;
  weight: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  useCustomMacros?: boolean;
  macroSplit?: MacroSplit;
}

export interface MealPlan {
  totalPortions: { protein: number; carbs: number; fats: number };
  breakfast: { protein: number; carbs: number; fats: number };
  snack1: { protein: number; carbs: number; fats: number };
  lunch: { protein: number; carbs: number; fats: number };
  snack2: { protein: number; carbs: number; fats: number };
  dinner: { protein: number; carbs: number; fats: number };
}

export interface CalculationResult {
  bmr: number;
  tdee: number;
  targetCalories: number;
  dailyProtein: number;
  dailyCarbs: number;
  dailyFats: number;
  mealPlan?: MealPlan;
}

// --- DATABASE TYPES ---

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  membership_level?: string; // 'free' | 'premium'
  isPremium?: boolean;       // Helper property often used in frontend
  is_staff?: boolean;
  subscription_status?: string;
  coaching_expires_at?: string; // DATE STRING from Google Sheets/Zapier
  biometrics?: {
    data: UserData;
    results: CalculationResult;
  } | any;
  created_at?: string;
  updated_at?: string;
}

export interface SavedRecipe {
  id: string;
  user_id: string;
  title: string;
  ingredients?: string[];  
  instructions?: string;   
  content?: string; 
  macros?: {               
    calories?: number;
    protein?: number;
    carbs?: number;
    fats?: number;
  };
  cooking_time?: string;
  tags?: string[];
  created_at: string;
  date?: string;
}

export interface ShoppingItem {
  id: string;
  user_id: string;
  item_name: string;
  amount: string;
  category?: string;
  is_checked: boolean;
  created_at: string;
}

export interface PantryItem {
  id: string;
  user_id: string;
  item_name: string;
  quantity?: string;
  created_at: string;
  category?: string;
}

// --- AI COACH & SUPPORT ---

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  message: string;
  category: string;
  status: 'open' | 'closed' | 'pending';
  created_at: string;
}

// --- AI GENERATION TYPES ---

export interface RecipeIdea {
  title: string;
  description: string;
  calories: number;
  macros?: {
    protein: number;
    carbs: number;
    fats: number;
  };
  tags?: string[];
}

export interface AIAdviceState {
  loading: boolean;
  content: string | null;
  error: string | null;
}

// --- MEAL TRACKING & DASHBOARD (UPPDATERAD) ---

export interface MealItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  quantity?: string; // T.ex. "100g" eller "1 port"
  timestamp: string; // ISO-sträng för sortering
}

export interface DailyLog {
  id?: string; 
  user_id: string;
  date: string; // 'YYYY-MM-DD'
  
  // Summerade värden (snake_case för att matcha DB)
  total_calories: number;
  total_protein: number;
  total_carbs: number;
  total_fat: number;
  
  water_intake: number;
  
  items: MealItem[]; // Hela listan med mat
  created_at?: string;
}

export interface ScannedMeal {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  description: string;
  tips: string;
}

// --- MOCK / PLACEHOLDER TYPES ---
// Behålls för att inte krascha gamla imports eller oimplementerade delar
export interface FoodItem { name: string; amount: string; type: 'PROTEIN' | 'CARBS' | 'FATS'; isVeg: boolean; macros?: { protein: number; carbs: number; fat: number; kcal: number; }; }
export interface WeeklyPlanItem { day: string; breakfast: string; lunch: string; dinner: string; }
export type WeeklyPlan = WeeklyPlanItem[];
export interface SavedWeeklyPlan { id: string; user_id: string; plan_data: WeeklyPlan; created_at: string; }
