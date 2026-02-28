import { create } from 'zustand';
import { supabase } from '../lib/supabase';

const EXPIRY_SYNC_TTL_MS = 12 * 60 * 60 * 1000;

const maybeSyncMembershipExpiry = async (
  profile: any,
  session: any,
  refreshProfile: () => Promise<void>,
  set: (state: Partial<AuthState>) => void,
) => {
  if (!profile?.email || !session?.access_token) return;
  if (typeof window === 'undefined') return;

  const key = `pto_membership_expiry_sync:${profile.id}`;
  const now = Date.now();
  const lastSync = Number(localStorage.getItem(key) || 0);
  if (Number.isFinite(lastSync) && now - lastSync < EXPIRY_SYNC_TTL_MS) return;

  localStorage.setItem(key, String(now));

  try {
    const response = await fetch('/api/membership-expiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ email: profile.email, user_id: profile.id }),
    });

    if (!response.ok) {
      console.warn('Membership expiry sync failed', response.status);
      return;
    }

    const data = await response.json();
    if (!data?.found) return;

    if (data.updated) {
      await refreshProfile();
      return;
    }

    const nextExpiresAt = data.coaching_expires_at ?? null;
    const nextStatus = data.subscription_status ?? null;
    if (profile.coaching_expires_at === nextExpiresAt && profile.subscription_status === nextStatus) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        coaching_expires_at: nextExpiresAt,
        subscription_status: nextStatus,
      })
      .eq('id', profile.id);
    if (error) {
      console.warn('Membership expiry update failed', error);
      return;
    }

    set({ profile: { ...profile, coaching_expires_at: nextExpiresAt, subscription_status: nextStatus } });
  } catch (error) {
    console.warn('Membership expiry sync error', error);
  }
};

interface AuthState {
  session: any;
  profile: any;
  profileError: string | null;
  isLoading: boolean;
  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  registerUser: (email: string, pass: string, name: string) => Promise<any>;
  signInUser: (email: string, pass: string) => Promise<any>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  profileError: null,
  isLoading: true, 

  initialize: async () => {
    // Sätt isLoading true vid första laddning
    if (!get().session) {
        set({ isLoading: true });
    }

    try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
            // Vi hämtar bara profilen (Triggern i databasen har redan skapat den!)
            // Vi lägger in en liten fördröjning/retry om triggern är långsam
            let { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

            if (profileError) {
              console.error('Profile load error:', profileError);
              set({ session, profile: null, profileError: profileError.message });
            } else {
              set({ session, profile, profileError: null });
            }
            if (profile) {
              await maybeSyncMembershipExpiry(profile, session, get().refreshProfile, set);
            }
        } else {
            set({ session: null, profile: null, profileError: null });
        }
    } catch (error) {
        console.error("Auth Init Error:", error);
        set({
          session: null,
          profile: null,
          profileError: error instanceof Error ? error.message : 'Okänt fel vid inloggning.'
        });
    } finally {
        set({ isLoading: false });
    }

    // Lyssna på ändringar
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            set({ session: null, profile: null, profileError: null, isLoading: false });
        } else if (event === 'SIGNED_IN' && session) {
            const current = get().session;
            if (!current || current.user.id !== session.user.id) {
                get().initialize();
            }
        }
    });
  },

  refreshProfile: async () => {
    const session = get().session;
    if (!session?.user) return;
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      if (error) {
        console.error('Profile refresh error:', error);
        set({ profileError: error.message });
        return;
      }
      set({ profile, profileError: null });
    } catch (error) {
      console.error('Profile refresh error:', error);
      set({ profileError: error instanceof Error ? error.message : 'Kunde inte uppdatera profilen.' });
    }
  },

  registerUser: async (email, password, name) => {
    // VIKTIGT: Vi skickar med 'full_name' i metadatan.
    // SQL-triggern vi skapade nyss kommer plocka upp detta och skapa profilen åt oss.
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
            data: { full_name: name } 
        }
    });
    
    // Vi gör ingen manuell insert här längre. Databasen sköter det.
    return { user: data.user, error };
  },

  signInUser: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { user: data.user, error };
  },

  signOut: async () => {
    await supabase.auth.signOut();
  }
}));
