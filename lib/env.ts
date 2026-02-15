
/**
 * STANDARD VITE ENV HANDLER
 * Prioriterar:
 * 1. Runtime injection (window.__ENV__) - För Docker/Cloud Run
 * 2. Vite Build-time vars (import.meta.env)
 * 3. Fallback (Hårdkodade för dev/backup)
 */

export const getEnv = (key: string): string => {
  // 1. Runtime Injection (Om du injicerar variabler i window-objektet via Docker/Cloud Run)
  if (typeof window !== 'undefined' && (window as any).__ENV__ && (window as any).__ENV__[key]) {
    return (window as any).__ENV__[key];
  }

  // 2. Vite Environment Variables
  const metaEnv = (import.meta as any).env || {};
  // Kolla både direkt nyckel och VITE_-prefix
  const val = metaEnv[key] || metaEnv[`VITE_${key}`];
  if (val && !val.includes('PLACEHOLDER')) {
    return val;
  }

  // 3. Fallbacks (Dina nuvarande nycklar)
  // OBS: Se till att "Website Restrictions" i Google Cloud Console tillåter din live-domän!
  
  if (key.includes('SUPABASE_URL')) {
     return 'https://cghnlrinjtexhvetngbe.supabase.co'; 
  }
  
  if (key.includes('SUPABASE_ANON_KEY')) {
     return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnaG5scmluanRleGh2ZXRuZ2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Nzc1NDMsImV4cCI6MjA4MDI1MzU0M30.PObEMpnvHDzKjiycEQzjojqAW_E9SpBeLTILArjxzac'; 
  }

  if (key.includes('API_KEY') || key.includes('GEMINI')) {
     return 'AIzaSyAaw1zsEW_7rnJb30UTDpiFsvI9i8gTVr0'; 
  }

  return '';
};
