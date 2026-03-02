import React, { useState, useEffect, useMemo } from 'react';
import { Copy, CheckCircle2, Sparkles, Gift, Star, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import {
    getCurrentTier,
    getNextTier,
    getReferralsToNextTier,
    REFERRAL_TIERS,
    REFERRAL_STATUS_LABELS,
    REFERRAL_STATUS_COLORS,
    type Referral,
} from '../utils/referralHelpers';

export const ReferralPage: React.FC = () => {
    const { session, profile } = useAuthStore();
    const [referrals, setReferrals] = useState<Referral[]>([]);
    const [copied, setCopied] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    const referralCode = profile?.referral_code || null;

    useEffect(() => {
        if (!profile?.id) return;
        const load = async () => {
            const { data } = await supabase
                .from('referrals')
                .select('id, referrer_id, referred_email, referred_user_id, status, created_at, converted_at')
                .eq('referrer_id', profile.id)
                .order('created_at', { ascending: false });
            if (data) setReferrals(data as Referral[]);
        };
        load().catch(() => undefined);
    }, [profile?.id]);

    const convertedCount = useMemo(
        () => referrals.filter((r) => r.status === 'converted' || r.status === 'rewarded').length,
        [referrals],
    );

    const currentTier = useMemo(() => getCurrentTier(convertedCount), [convertedCount]);
    const nextTier = useMemo(() => getNextTier(convertedCount), [convertedCount]);
    const toNext = useMemo(() => getReferralsToNextTier(convertedCount), [convertedCount]);

    const referralLink = referralCode
        ? `${window.location.origin}/register?ref=${referralCode}`
        : '';

    const handleCopy = () => {
        navigator.clipboard.writeText(referralLink).catch(() => undefined);
        setCopied(true);
        setShowConfetti(true);
        setTimeout(() => setCopied(false), 2000);
        setTimeout(() => setShowConfetti(false), 3000);
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'PTO – Bli medlem!',
                    text: `Jag tränar med PTO och det har förändrat min vardag. Testa du också! Använd min länk:`,
                    url: referralLink,
                });
            } catch {
                handleCopy();
            }
        } else {
            handleCopy();
        }
    };

    if (!session) {
        return (
            <div className="min-h-screen bg-[#F6F1E7] flex items-center justify-center">
                <p className="text-[#6B6158]">Logga in för att se ditt referral-program.</p>
            </div>
        );
    }

    const tierProgress = nextTier
        ? ((convertedCount - currentTier.minReferrals) / (nextTier.minReferrals - currentTier.minReferrals)) * 100
        : 100;

    return (
        <div className="min-h-screen bg-[#F6F1E7] pb-20 animate-fade-in font-sans text-[#3D3D3D] relative overflow-hidden">
            {/* Confetti burst */}
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-3 h-3 rounded-full animate-ping"
                            style={{
                                backgroundColor: ['#a0c81d', '#F29B7B', '#60A5FA', '#FBBF24', '#A78BFA'][i % 5],
                                top: `${30 + Math.random() * 40}%`,
                                left: `${20 + Math.random() * 60}%`,
                                animationDelay: `${Math.random() * 0.5}s`,
                                animationDuration: `${0.8 + Math.random() * 0.5}s`,
                            }}
                        />
                    ))}
                </div>
            )}

            <div className="max-w-2xl mx-auto px-4 md:px-8 pt-10 md:pt-16 space-y-6">
                {/* Tier Badge Hero */}
                <div className="relative overflow-hidden rounded-[2.8rem] border border-[#DAD1C5] bg-white p-8 md:p-12 shadow-[0_35px_90px_rgba(61,61,61,0.2)] ring-1 ring-black/5">
                    <div className="absolute inset-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#E8F1D5] via-[#F6F1E7] to-white opacity-90" />
                        <div className="absolute left-[-20%] top-[-30%] h-[420px] w-[420px] rounded-full bg-[#a0c81d]/15 blur-[130px]" />
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158] mb-6">
                            <Sparkles className="w-3 h-3 text-[#a0c81d]" /> Referral Program
                        </div>

                        <div className="flex items-center gap-4 mb-6">
                            <div className={`w-20 h-20 rounded-3xl ${currentTier.bgColor} flex items-center justify-center text-4xl shadow-lg`}>
                                {currentTier.emoji}
                            </div>
                            <div>
                                <div className={`text-sm font-black uppercase tracking-widest ${currentTier.color}`}>
                                    Nivå: {currentTier.name}
                                </div>
                                <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D] mt-1">
                                    Tipsa & tjäna 💚
                                </h1>
                            </div>
                        </div>

                        {nextTier ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-[#6B6158]">{currentTier.emoji} {currentTier.name}</span>
                                    <span className="font-bold text-[#6B6158]">{nextTier.emoji} {nextTier.name}</span>
                                </div>
                                <div className="w-full h-3 rounded-full bg-[#E6E1D8] overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-[#a0c81d] to-[#5C7A12] transition-all duration-700"
                                        style={{ width: `${Math.min(100, tierProgress)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-[#8A8177]">
                                    <span className="font-black text-[#3D3D3D]">{toNext}</span> referral{toNext === 1 ? '' : 's'} kvar till {nextTier.emoji} <span className="font-bold">{nextTier.name}</span>
                                    {nextTier.reward && <span className="text-[#a0c81d]"> → {nextTier.reward}</span>}
                                </p>
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 text-center">
                                <p className="text-sm font-bold text-violet-700">👑 Du har nått högsta nivån! Grattis!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Share Card */}
                <div className="rounded-[2rem] border border-[#DAD1C5] bg-white p-6 shadow-xl ring-1 ring-black/5 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B6158]">Din personliga länk</p>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            value={referralLink || 'Laddar...'}
                            className="flex-1 rounded-xl border border-[#E6E1D8] bg-[#FAFAFA] px-4 py-3 text-sm text-[#3D3D3D] font-mono truncate"
                        />
                        <button
                            type="button"
                            onClick={handleCopy}
                            className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${copied
                                ? 'bg-emerald-500 text-white scale-105'
                                : 'bg-[#a0c81d] text-white hover:bg-[#5C7A12] hover:scale-105'
                                } shadow-[0_8px_24px_rgba(160,200,29,0.3)]`}
                        >
                            {copied ? <><CheckCircle2 className="w-4 h-4" /> Kopierat!</> : <><Copy className="w-4 h-4" /> Kopiera</>}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleShare}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#E6E1D8] bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-[#3D3D3D] hover:border-[#a0c81d]/40 hover:shadow-md transition-all"
                    >
                        <Zap className="w-4 h-4 text-[#a0c81d]" /> Dela via SMS / mejl
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-[#DAD1C5] bg-white p-4 text-center shadow-lg">
                        <div className="text-3xl font-black text-[#3D3D3D]">{referrals.length}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mt-1">Tipsade</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-center shadow-lg">
                        <div className="text-3xl font-black text-emerald-600">{convertedCount}</div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mt-1">Blivit medlemmar</div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 text-center shadow-lg">
                        <div className="text-3xl font-black text-amber-600">
                            {referrals.filter((r) => r.status === 'rewarded').length}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-700 mt-1">Belöningar</div>
                    </div>
                </div>

                {/* Tier Roadmap */}
                <div className="rounded-[2rem] border border-[#DAD1C5] bg-white p-6 shadow-xl ring-1 ring-black/5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B6158] mb-4">Belöningsstege</p>
                    <div className="space-y-3">
                        {REFERRAL_TIERS.slice(1).map((tier) => {
                            const reached = convertedCount >= tier.minReferrals;
                            return (
                                <div
                                    key={tier.name}
                                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${reached
                                        ? `${tier.bgColor} border-transparent shadow-md`
                                        : 'border-[#E6E1D8] bg-white opacity-60'
                                        }`}
                                >
                                    <span className="text-2xl">{tier.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-sm font-black ${reached ? tier.color : 'text-[#8A8177]'}`}>
                                            {tier.name}
                                        </div>
                                        <div className="text-[11px] text-[#6B6158]">{tier.reward}</div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className={`text-xs font-black ${reached ? 'text-emerald-600' : 'text-[#8A8177]'}`}>
                                            {reached ? '✓' : `${tier.minReferrals} tips`}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Referral History */}
                {referrals.length > 0 && (
                    <div className="rounded-[2rem] border border-[#DAD1C5] bg-white p-6 shadow-xl ring-1 ring-black/5">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B6158] mb-4">Dina tips</p>
                        <div className="space-y-2">
                            {referrals.slice(0, 15).map((r) => (
                                <div key={r.id} className="flex items-center justify-between rounded-xl border border-[#E6E1D8] bg-[#FAFAFA] p-3">
                                    <span className="text-sm text-[#3D3D3D] truncate">{r.referred_email}</span>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full ${REFERRAL_STATUS_COLORS[r.status]}`}>
                                        {REFERRAL_STATUS_LABELS[r.status]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* How it works */}
                <div className="rounded-[2rem] border border-[#DAD1C5] bg-gradient-to-r from-[#E8F1D5]/60 to-white p-6 shadow-lg ring-1 ring-black/5">
                    <h3 className="text-sm font-black text-[#3D3D3D] mb-3">Så fungerar det</h3>
                    <div className="space-y-3">
                        {[
                            { icon: Copy, text: 'Kopiera din personliga länk', color: 'text-sky-500' },
                            { icon: Zap, text: 'Skicka till en vän via SMS, mejl eller social media', color: 'text-amber-500' },
                            { icon: Star, text: 'Din vän registrerar sig och blir medlem', color: 'text-emerald-500' },
                            { icon: Gift, text: 'Ni båda får belöning! Klättra i nivåerna!', color: 'text-violet-500' },
                        ].map((step, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white border border-[#E6E1D8] flex items-center justify-center shadow-sm">
                                    <step.icon className={`w-4 h-4 ${step.color}`} />
                                </div>
                                <span className="text-sm text-[#3D3D3D] font-medium">{step.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
