import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Lock, Mail, User, Loader2, ArrowRight, Gift, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export const ReferralRegister: React.FC = () => {
    const [searchParams] = useSearchParams();
    const refCode = searchParams.get('ref') || '';

    const { registerUser } = useAuthStore();
    const isConfigured = isSupabaseConfigured();

    const [referrerName, setReferrerName] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    // Look up referrer name from code
    useEffect(() => {
        if (!refCode) return;
        localStorage.setItem('pto_referral_code', refCode);
        const lookup = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('referral_code', refCode)
                .maybeSingle();
            if (data?.full_name) {
                const firstName = (data.full_name as string).split(' ')[0];
                setReferrerName(firstName);
            }
        };
        lookup().catch(() => undefined);
    }, [refCode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!name.trim()) { setError('Ange ditt namn.'); return; }
        setLoading(true);

        try {
            const { user, error: regError } = await registerUser(email, password, name);
            if (regError) throw regError;

            if (user) {
                // Match referral
                const storedRef = refCode || localStorage.getItem('pto_referral_code');
                if (storedRef && user.id) {
                    (async () => {
                        await supabase.rpc('match_referral', {
                            p_ref_code: storedRef,
                            p_email: email,
                            p_user_id: user.id,
                        });
                        localStorage.removeItem('pto_referral_code');
                    })().catch(() => undefined);
                }
                setDone(true);
            }
        } catch (err: any) {
            if (err.message?.includes('already registered')) {
                setError('Den här e-postadressen finns redan. Logga in istället.');
            } else {
                setError(err.message || 'Ett fel uppstod.');
            }
        } finally {
            setLoading(false);
        }
    };

    // No ref code -> redirect to normal login
    if (!refCode) {
        return (
            <div className="min-h-screen bg-[#F6F1E7] flex items-center justify-center">
                <div className="text-center space-y-4">
                    <p className="text-[#6B6158]">Ingen referenslänk hittades.</p>
                    <Link to="/auth" className="inline-flex items-center gap-2 text-[#a0c81d] font-bold text-sm hover:underline">
                        Gå till inloggning <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F6F1E7] pb-20 animate-fade-in font-sans text-[#3D3D3D] flex items-center justify-center">
            <div className="w-full max-w-md px-4">

                {/* Hero */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl border border-[#E6E1D8] shadow-2xl mb-6">
                        <Gift className="w-10 h-10 text-[#a0c81d]" />
                    </div>

                    {referrerName ? (
                        <>
                            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-4">
                                <Sparkles className="w-3 h-3" /> Inbjudan från {referrerName}
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D]">
                                {referrerName} tycker att du ska testa PTO! 💚
                            </h1>
                        </>
                    ) : (
                        <>
                            <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-4">
                                <Sparkles className="w-3 h-3" /> Du har blivit tipsad!
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D]">
                                Välkommen till PTO! 💚
                            </h1>
                        </>
                    )}
                    <p className="text-sm text-[#6B6158] mt-2">
                        Skapa ett konto på 30 sekunder och kom igång direkt.
                    </p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-[2.5rem] shadow-[0_35px_90px_rgba(61,61,61,0.18)] overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-[#a0c81d]" />

                    <div className="p-8 md:p-10">
                        {done ? (
                            <div className="text-center py-8 space-y-4 animate-fade-in">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h2 className="text-xl font-black text-[#3D3D3D]">Konto skapat! 🎉</h2>
                                <p className="text-sm text-[#6B6158]">
                                    Kontrollera din e-post för att bekräfta kontot. Sedan är du redo!
                                </p>
                                <Link
                                    to="/auth"
                                    className="inline-flex items-center gap-2 rounded-full bg-[#a0c81d] px-6 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-[#5C7A12] shadow-[0_12px_30px_rgba(160,200,29,0.3)] transition-all"
                                >
                                    Logga in <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-[#6B6158] uppercase tracking-widest ml-1">Ditt namn</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6158] group-focus-within:text-[#a0c81d] transition-colors" />
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-0 focus:border-[#a0c81d] outline-none font-bold text-slate-800 placeholder:text-[#6B6158] transition-all text-sm"
                                            placeholder="Förnamn Efternamn"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-[#6B6158] uppercase tracking-widest ml-1">E-postadress</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6158] group-focus-within:text-[#a0c81d] transition-colors" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-0 focus:border-[#a0c81d] outline-none font-bold text-slate-800 placeholder:text-[#6B6158] transition-all text-sm"
                                            placeholder="namn@exempel.se"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-[#6B6158] uppercase tracking-widest ml-1">Lösenord</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6158] group-focus-within:text-[#a0c81d] transition-colors" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:ring-0 focus:border-[#a0c81d] outline-none font-bold text-slate-800 placeholder:text-[#6B6158] transition-all text-sm"
                                            placeholder="Minst 6 tecken"
                                            minLength={6}
                                            required
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold border border-red-100 animate-fade-in">
                                        {error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !isConfigured}
                                    className="w-full bg-[#a0c81d] hover:bg-[#5C7A12] text-white font-black py-4 rounded-xl shadow-[0_18px_40px_rgba(160,200,29,0.35)] hover:shadow-[0_22px_50px_rgba(160,200,29,0.4)] transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            Skapa konto <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>

                                <p className="text-center text-xs text-[#8A8177]">
                                    Har du redan ett konto?{' '}
                                    <Link to="/auth" className="text-[#a0c81d] font-bold hover:underline">Logga in</Link>
                                </p>
                            </form>
                        )}
                    </div>
                </div>

                {/* Benefits */}
                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                    {[
                        { emoji: '🏋️', label: 'Personlig coach' },
                        { emoji: '🥗', label: 'Veckomeny & recept' },
                        { emoji: '📊', label: 'Spåra din progress' },
                    ].map((b) => (
                        <div key={b.label} className="rounded-2xl border border-[#DAD1C5] bg-white/80 p-3 shadow-sm">
                            <div className="text-2xl mb-1">{b.emoji}</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-[#6B6158]">{b.label}</div>
                        </div>
                    ))}
                </div>

                <p className="text-center text-[10px] text-[#8A8177] mt-6 flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" /> Din data är krypterad och säker.
                </p>
            </div>
        </div>
    );
};
