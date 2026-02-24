
import { supabase } from '../lib/supabase';
import { UserProfile, UserData, CalculationResult, SavedRecipe, ShoppingItem, PantryItem, DailyLog, MealItem, SupportTicket } from '../types';

export const databaseService = {
  // --- USER PROFILE ---
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  },

  async updateUserBiometrics(userId: string, data: UserData, results: CalculationResult): Promise<UserProfile | null> {
    const { data: updated, error } = await supabase
      .from('profiles')
      .update({ 
        biometrics: { data, results },
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating biometrics:', error);
      return null;
    }
    return updated;
  },

  // --- RECIPES ---
  async getSavedRecipes(userId: string): Promise<SavedRecipe[]> {
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recipes:', error);
      return [];
    }
    return data || [];
  },

  async saveRecipe(recipe: Partial<SavedRecipe>): Promise<boolean> {
    const { error } = await supabase
      .from('recipes')
      .insert([recipe]);

    if (error) {
      console.error('Error saving recipe:', error);
      return false;
    }
    return true;
  },

  // --- WEEKLY PLANS ---
  async getSavedPlans(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  },

  async saveWeeklyPlan(userId: string, planData: any[], title: string = 'Veckomeny'): Promise<boolean> {
    const { error } = await supabase
      .from('weekly_plans')
      .insert([{ user_id: userId, plan_data: planData, title }]);

    if (error) {
      console.error('Error saving plan:', error);
      console.error('Error saving plan details:', {
        message: (error as any)?.message,
        details: (error as any)?.details,
        hint: (error as any)?.hint,
        code: (error as any)?.code
      });
      return false;
    }
    return true;
  },

  async deleteWeeklyPlan(planId: string): Promise<boolean> {
    const { error } = await supabase
      .from('weekly_plans')
      .delete()
      .eq('id', planId);
    return !error;
  },

  // --- UPPFOLJNING ---
  async getLatestUppfoljning(userId: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('uppfoljningar')
      .select('id, created_at, is_done, done_at, done_by')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching uppfoljning:', error);
      return null;
    }
    return data || null;
  },

  async getUserStartformular(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('startformular')
      .select('id, created_at, is_done, done_at, desired_start_date, goal_description, focus_areas')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching startformular:', error);
      return [];
    }
    return data || [];
  },

  async getUserUppfoljningar(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('uppfoljningar')
      .select('id, created_at, is_done, done_at, summary_feedback, goal')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching uppfoljningar:', error);
      return [];
    }
    return data || [];
  },

  // --- SHOPPING LIST ---
  async getShoppingList(userId: string): Promise<ShoppingItem[]> {
    const { data, error } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  },

  async addShoppingItem(userId: string, itemName: string, amount: string = '1 st', category: string = 'Övrigt'): Promise<ShoppingItem | null> {
    const { data, error } = await supabase
      .from('shopping_list')
      .insert([{ user_id: userId, item_name: itemName, amount, category, is_checked: false }])
      .select()
      .single();

    if (error) return null;
    return data;
  },

  async addShoppingItems(userId: string, items: string[]): Promise<boolean> {
    if (!items.length) return true;
    const payload = items.map(item => ({
      user_id: userId,
      item_name: item,
      amount: '1 st',
      is_checked: false
    }));
    
    const { error } = await supabase.from('shopping_list').insert(payload);
    return !error;
  },

  async toggleShoppingItem(itemId: string, isChecked: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('shopping_list')
      .update({ is_checked: isChecked })
      .eq('id', itemId);
    return !error;
  },

  async deleteShoppingItem(itemId: string): Promise<boolean> {
    const { error } = await supabase.from('shopping_list').delete().eq('id', itemId);
    return !error;
  },

  async clearCheckedItems(userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('user_id', userId)
      .eq('is_checked', true);
    return !error;
  },

  // --- PANTRY ---
  async getPantryItems(userId: string): Promise<PantryItem[]> {
    const { data, error } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return [];
    return data || [];
  },

  async addPantryItem(userId: string, itemName: string, category: string = 'Övrigt', quantity: string = '1 st'): Promise<PantryItem | null> {
    const { data, error } = await supabase
      .from('pantry_items')
      .insert([{ user_id: userId, item_name: itemName, category, quantity }])
      .select()
      .single();
    
    if (error) return null;
    return data;
  },

  async deletePantryItem(itemId: string): Promise<boolean> {
    const { error } = await supabase.from('pantry_items').delete().eq('id', itemId);
    return !error;
  },

  // --- LOGGING / TRACKING ---
  async getDailyLog(userId: string, date: string): Promise<DailyLog | null> {
    // Attempt to find existing log
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) {
      console.error("Error getting log:", error);
      return null;
    }
    
    if (!data) {
        // Return an empty log structure if none exists (frontend handles creation or we can create here)
        return {
            user_id: userId,
            date,
            total_calories: 0,
            total_protein: 0,
            total_carbs: 0,
            total_fat: 0,
            water_intake: 0,
            items: []
        };
    }
    
    return data;
  },

  async logMeal(userId: string, mealItem: MealItem): Promise<boolean> {
    const date = mealItem.timestamp.split('T')[0];
    
    // 1. Get current log
    let currentLog = await this.getDailyLog(userId, date);
    
    if (!currentLog) return false;

    // 2. Update values
    const newItems = [...(currentLog.items || []), mealItem];
    const newStats = {
        total_calories: (currentLog.total_calories || 0) + mealItem.calories,
        total_protein: (currentLog.total_protein || 0) + mealItem.protein,
        total_carbs: (currentLog.total_carbs || 0) + mealItem.carbs,
        total_fat: (currentLog.total_fat || 0) + mealItem.fat,
    };

    // 3. Upsert
    const { error } = await supabase
        .from('daily_logs')
        .upsert({
            user_id: userId,
            date: date,
            items: newItems,
            ...newStats
        }, { onConflict: 'user_id, date' });

    return !error;
  },

  async searchFoodDatabase(_query: string, _page: number): Promise<MealItem[]> {
    // Placeholder: In a real app, this would query a dedicated table or external API
    // We mock empty for now as fallback
    return []; 
  },

  // --- SUPPORT ---
  async createSupportTicket(userId: string | null | undefined, message: string, category: string): Promise<boolean> {
    const payload: any = { message, category, status: 'open' };
    if (userId) {
      payload.user_id = userId;
    }
    
    const { error } = await supabase
      .from('support_tickets')
      .insert([payload]);
    
    if (error) console.error("Create Ticket Error:", error);
    return !error;
  },

  async getUserTickets(userId: string): Promise<SupportTicket[]> {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error getting tickets:", error);
      return [];
    }
    return data || [];
  }
};
