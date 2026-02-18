
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

  const isDev = Boolean(metaEnv?.DEV || metaEnv?.MODE === 'development');
  if (isDev) {
    // Undvik att läcka hemligheter via hårdkodade fallback-nycklar
    // och gör det tydligt när en env saknas under dev.
    console.warn(`[env] Missing ${key}`);
  }

  return '';
};
