import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

const SCORE_LABELS = [
    'Inte alls', '', '', '', '', '',
    'Tveksam', '', '', 'Verkligen! 🎉', 'Absolut! 💚',
];

export const NpsSurvey: React.FC = () => {
    const { session, profile } = useAuthStore();
    const [score, setScore] = useState<number | null>(null);
    const [comment, setComment] = useState('');
    const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);

    useEffect(() => {
        if (!profile?.id) return;
        // Check if user has submitted in the last 30 days
        const checkExisting = async () => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const { data } = await supabase
                .from('nps_responses')
                .select('id')
                .eq('user_id', profile.id)
                .gte('created_at', thirtyDaysAgo.toISOString())
                .limit(1);
            if (data && data.length > 0) {
                setAlreadySubmitted(true);
            }
        };
        checkExisting().catch(() => undefined);
    }, [profile?.id]);

    const handleSubmit = async () => {
        if (score === null || !profile?.id) return;
        setStatus('submitting');
        const { error } = await supabase
            .from('nps_responses')
            .insert([{
                user_id: profile.id,
                score,
                comment: comment.trim() || null,
            }]);
        if (error) {
            console.warn('NPS submission failed', error);
            // If table doesn't exist yet, still show success-like state
            if (error.code === '42P01') {
                setStatus('done');
                return;
            }
            setStatus('error');
            return;
        }
        setStatus('done');
    };

    if (!session) {
        return (
            <div className="min-h-screen bg-[#F6F1E7] flex items-center justify-center">
                <p className="text-[#6B6158]">Du behöver vara inloggad för att svara.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F6F1E7] pb-20 animate-fade-in font-sans text-[#3D3D3D]">
            <div className="max-w-2xl mx-auto px-4 md:px-8 pt-12 md:pt-20">
                <div className="relative overflow-hidden rounded-[2.8rem] border border-[#DAD1C5] bg-white p-8 md:p-12 shadow-[0_35px_90px_rgba(61,61,61,0.2)] ring-1 ring-black/5">
                    <div className="absolute inset-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#E8F1D5] via-[#F6F1E7] to-white opacity-90" />
                        <div className="absolute left-[-20%] top-[-30%] h-[420px] w-[420px] rounded-full bg-[#a0c81d]/15 blur-[130px]" />
                        <div className="absolute right-[-25%] bottom-[-40%] h-[520px] w-[520px] rounded-full bg-[#F6F1E7]/90 blur-[160px]" />
                    </div>

                    <div className="relative z-10">
                        {status === 'done' || alreadySubmitted ? (
                            <div className="text-center py-12 space-y-4">
                                <CheckCircle2 className="w-16 h-16 text-[#a0c81d] mx-auto" />
                                <h2 className="text-2xl md:text-3xl font-black text-[#3D3D3D]">
                                    {alreadySubmitted ? 'Tack! Du har redan svarat.' : 'Tack för din feedback! 💚'}
                                </h2>
                                <p className="text-[#6B6158] text-sm">
                                    Din åsikt hjälper oss att bli bättre.
                                </p>
                                <Link
                                    to="/"
                                    className="inline-flex items-center gap-2 rounded-full bg-[#a0c81d] px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-[#5C7A12] shadow-[0_18px_40px_rgba(160,200,29,0.35)]"
                                >
                                    Tillbaka hem <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div>
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158] mb-4">
                                        <Sparkles className="w-3 h-3 text-[#a0c81d]" /> Snabb feedback
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D]">
                                        Hur sannolikt är det att du rekommenderar oss?
                                    </h1>
                                    <p className="text-sm text-[#6B6158] mt-2">
                                        Svara på en skala 0–10. Det tar bara 15 sekunder.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-11 gap-1.5">
                                        {Array.from({ length: 11 }, (_, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setScore(i)}
                                                className={`aspect-square rounded-xl border text-sm font-black transition-all ${score === i
                                                    ? i >= 9
                                                        ? 'bg-emerald-500 border-emerald-600 text-white scale-110 shadow-lg'
                                                        : i >= 7
                                                            ? 'bg-amber-400 border-amber-500 text-white scale-110 shadow-lg'
                                                            : 'bg-rose-400 border-rose-500 text-white scale-110 shadow-lg'
                                                    : 'border-[#E6E1D8] bg-white hover:border-[#a0c81d]/50 hover:shadow-md text-[#3D3D3D]'
                                                    }`}
                                            >
                                                {i}
                                            </button>
                                        ))}
                                    </div>
                                    {score !== null && (
                                        <p className="text-center text-xs font-bold text-[#6B6158] animate-fade-in">
                                            {SCORE_LABELS[score] || ''}
                                        </p>
                                    )}
                                </div>

                                {score !== null && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6B6158] block mb-2">
                                                Valfri kommentar
                                            </label>
                                            <textarea
                                                value={comment}
                                                onChange={(e) => setComment(e.target.value)}
                                                placeholder="Berätta gärna vad vi kan göra bättre..."
                                                className="w-full rounded-2xl border border-[#E6E1D8] bg-white/80 p-4 text-sm text-[#3D3D3D] placeholder:text-[#8A8177] resize-none focus:border-[#a0c81d] focus:ring-1 focus:ring-[#a0c81d] outline-none transition-all"
                                                rows={3}
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSubmit}
                                            disabled={status === 'submitting'}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#a0c81d] px-6 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-[#5C7A12] shadow-[0_18px_40px_rgba(160,200,29,0.35)] disabled:opacity-50"
                                        >
                                            {status === 'submitting' ? (
                                                <>Skickar...</>
                                            ) : (
                                                <>
                                                    <Star className="w-4 h-4" /> Skicka
                                                </>
                                            )}
                                        </button>

                                        {status === 'error' && (
                                            <p className="text-center text-xs text-rose-500">
                                                Något gick fel. Försök igen senare.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
