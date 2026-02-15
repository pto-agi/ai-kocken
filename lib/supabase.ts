import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env'; // <--- OBS: ./env eftersom båda ligger i lib-mappen

// Hämta nycklarna via din special-funktion
const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Kontroll för att se så vi inte kör mock-läge i onödan
const isConfigured = supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder');

export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true }
    })
  : createClient('https://mock.supabase.co', 'mock-key', {
      auth: { persistSession: false, autoRefreshToken: false }
    });

export const isSupabaseConfigured = () => isConfigured;