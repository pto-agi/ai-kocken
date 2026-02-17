
import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { Lock, Mail, AlertCircle, Cpu, CheckCircle2, Database, User, Loader2, ArrowRight } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';

interface AuthScreenProps {
  embedded?: boolean;
  onSuccess?: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ embedded = false, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Local Loading State
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { registerUser, signInUser } = useAuthStore();
  const isConfigured = isSupabaseConfigured();

  const handleGoogleLogin = async () => {
    if (!isConfigured) { setError("Databas ej kopplad."); return; }
    try {
      setGoogleLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error: any) {
      setError('Kunde inte ansluta till Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!isConfigured) {
        setError("Databas ej kopplad.");
        setLoading(false);
        return;
    }

    try {
      if (isLogin) {
        // --- LOGIN ---
        const { error, user } = await signInUser(email, password);
        if (error) throw error;
        if (onSuccess) {
            onSuccess();
        } else if (!embedded) {
            const from = (location.state as any)?.from?.pathname || '/';
            navigate(from, { replace: true });
        } else {
            window.location.reload();
        }
      } else {
        // --- REGISTER ---
        if (!name.trim()) {
            setError("Ange ditt namn.");
            setLoading(false);
            return;
        }
        const { user, error } = await registerUser(email, password, name);
        if (error) throw error;
        
        if (user) {
           setSuccessMsg("Konto skapat! Kontrollera din e-post.");
           setLoading(false);
        } else {
            setLoading(false);
        }
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setLoading(false);
      if (err.message?.includes("Invalid login credentials")) {
        setError("Fel e-post eller lösenord.");
      } else {
        setError(err.message || 'Ett fel uppstod.');
      }
    }
  };

  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden ${
        embedded 
        ? 'w-full py-10 min-h-[600px]' 
        : 'min-h-[calc(100vh-5rem)] w-full bg-[#0f172a] pt-24'
    }`}>
      
      {/* Background Effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#a0c81d]/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md px-6">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl border border-white/10 shadow-2xl mb-6 relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <img src="/pto-logotyp-2026.png" alt="PTO" className="w-9 h-9 object-contain" />
            </div>
            
            <div className="flex items-baseline justify-center leading-none mb-2">
                <span className="text-3xl font-black text-white tracking-tight font-heading">PTO</span>
                <span className="text-3xl font-black text-[#a0c81d] font-heading ml-1">Ai</span>
            </div>
            <p className="text-slate-400 text-sm font-medium">
                {isLogin ? 'Logga in för att komma åt din profil' : 'Skapa ett konto för att börja din resa'}
            </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative">
            
            {/* Top Pattern */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-[#a0c81d]"></div>

            <div className="p-8 md:p-10">
                
                {/* Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-xl mb-8 relative">
                    <button 
                        onClick={() => { setIsLogin(true); setError(null); }}
                        className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-all z-10 ${
                            isLogin ? 'text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        Logga in
                    </button>
                    <button 
                        onClick={() => { setIsLogin(false); setError(null); }}
                        className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-all z-10 ${
                            !isLogin ? 'text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        Skapa konto
                    </button>
                    {/* Animated Background Pill */}
                    <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow transition-all duration-300 ${isLogin ? 'left-1' : 'left-[calc(50%+2px)]'}`}></div>
                </div>

                {successMsg ? (
                    <div className="bg-emerald-50 text-emerald-800 p-6 rounded-2xl text-center border border-emerald-100 flex flex-col items-center animate-fade-in">
                        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        </div>
                        <h3 className="font-bold text-lg mb-1">Konto skapat!</h3>
                        <p className="text-sm">{successMsg}</p>
                    </div>
                ) : (
                    <form onSubmit={handleAuth} className="space-y-5">
                        
                        {!isLogin && (
                            <div className="space-y-2 animate-fade-in">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Ditt Namn</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#a0c81d] transition-colors" />
                                    <input 
                                        type="text" 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)} 
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-0 focus:border-[#a0c81d] outline-none font-bold text-slate-800 placeholder:text-slate-300 transition-all text-sm" 
                                        placeholder="Förnamn Efternamn" 
                                        required={!isLogin} 
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-postadress</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#a0c81d] transition-colors" />
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)} 
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-0 focus:border-[#a0c81d] outline-none font-bold text-slate-800 placeholder:text-slate-300 transition-all text-sm" 
                                    placeholder="namn@exempel.se" 
                                    required 
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lösenord</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300 group-focus-within:text-[#a0c81d] transition-colors" />
                                <input 
                                    type="password" 
                                    value={password} 
                                    onChange={(e) => setPassword(e.target.value)} 
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-0 focus:border-[#a0c81d] outline-none font-bold text-slate-800 placeholder:text-slate-300 transition-all text-sm" 
                                    placeholder="••••••••" 
                                    minLength={6} 
                                    required 
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold flex items-start gap-3 border border-red-100 animate-fade-in">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="flex-1">{error}</div>
                            </div>
                        )}

                        {!isConfigured && (
                            <div className="bg-amber-50 text-amber-700 p-4 rounded-xl text-xs font-bold flex items-start gap-3 border border-amber-100">
                                <Database className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="flex-1">Databas ej kopplad (API-nycklar saknas).</div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !isConfigured}
                            className="w-full bg-[#0f172a] hover:bg-slate-800 text-white font-black py-4 rounded-xl shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 mt-4 text-sm uppercase tracking-wider"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? 'Logga in' : 'Registrera Konto'}
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>
                )}

                <div className="relative flex py-6 items-center">
                    <div className="flex-grow border-t border-slate-100"></div>
                    <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-300 uppercase tracking-widest">Eller</span>
                    <div className="flex-grow border-t border-slate-100"></div>
                </div>

                <button
                    onClick={handleGoogleLogin}
                    disabled={googleLoading || !isConfigured}
                    className="w-full bg-white hover:bg-slate-50 text-slate-600 font-bold py-3.5 rounded-xl border-2 border-slate-100 transition-all flex items-center justify-center gap-3 text-sm hover:border-slate-200"
                >
                    {googleLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                    )}
                    <span>{isLogin ? 'Logga in med Google' : 'Registrera med Google'}</span>
                </button>

            </div>
        </div>
        
        {/* Footer info */}
        <div className="mt-8 text-center text-slate-500 text-xs font-medium">
            <p className="flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Din data är krypterad och säker.
            </p>
        </div>

      </div>
    </div>
  );
};

export default AuthScreen;
