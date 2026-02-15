import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: any;
  profile: any;
  isLoading: boolean;
  initialize: () => Promise<void>;
  registerUser: (email: string, pass: string, name: string) => Promise<any>;
  signInUser: (email: string, pass: string) => Promise<any>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
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
            let { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();

            set({ session, profile });
        } else {
            set({ session: null, profile: null });
        }
    } catch (error) {
        console.error("Auth Init Error:", error);
        set({ session: null, profile: null });
    } finally {
        set({ isLoading: false });
    }

    // Lyssna på ändringar
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            set({ session: null, profile: null, isLoading: false });
        } else if (event === 'SIGNED_IN' && session) {
            const current = get().session;
            if (!current || current.user.id !== session.user.id) {
                get().initialize();
            }
        }
    });
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