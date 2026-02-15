import React, { useState, useEffect } from 'react';
import { 
  Check, Star, ShieldCheck, Crown, Sparkles, ArrowRight, Loader2, Lock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface PremiumPaywallProps {
  variant?: 'premium' | 'auth'; 
  title?: string;
  description?: string;
  onAuthSuccess?: () => void;
}

const STRIPE_LINK = 'https://betalning.privatetrainingonline.se/b/cNi00i4bN9lBaqO4sDcfK0v?locale=sv';

const PremiumPaywall: React.FC<PremiumPaywallProps> = ({ 
  variant = 'premium', 
  title, 
  description,
  onAuthSuccess
}) => {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isPremium = variant === 'premium';

  // 1. Kontrollera session direkt när komponenten laddas
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    checkUser();
  }, []);

  // 2. Hantera klick för redan inloggade användare
  const handleDirectPayment = () => {
    if (!userEmail) return;
    setIsRedirecting(true);
    
    // Bygg URL säkert med e-post
    const url = new URL(STRIPE_LINK);
    url.searchParams.set('prefilled_email', userEmail);
    window.location.href = url.toString();
  };

  // --- COPYWRITING & TEXT ---
  const content = isPremium ? {
    badge: "Premium Medlemskap",
    badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    gradient: "from-[#0f172a] to-[#1e293b]",
    accent: "text-emerald-400",
    features: [
      "Obegränsad AI-Kock & Recept", 
      "Automatisk Veckoplanering", 
      "Djupgående Metabolisk Analys", 
      "Ingen bindningstid – avsluta när du vill"
    ],
    displayTitle: title || "Investera i din biologi.",
    displayDesc: description || "Sluta gissa. Få tillgång till marknadens mest avancerade AI-verktyg och nå dina mål snabbare."
  } : {
    badge: "Konto krävs",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    gradient: "from-[#0f172a] to-[#1e293b]",
    accent: "text-cyan-400",
    features: [
      "PTO Ai skapar recept efter dina mål, allergier, preferenser och egna önskemål.", 
      "Recept och veckomenyer skapas i realtid utifrån din kalibrering.", 
      "Kostschema med makron och inköpslista ingår i PDF-export.", 
      "Spara dina veckomenyer och återanvänd när du vill.", 
    ],
    displayTitle: title || "Skapa konto",
    displayDesc: description || "Spara recept, följ din utveckling och få tillgång kraftfulla Ai-verktyg för din kost och hälsa. Registrera dig för endast 99:- per månad."
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 animate-fade-in-up font-sans">
      <div className="max-w-lg w-full bg-[#1e293b] rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10 relative ring-1 ring-white/5">
        
        {/* --- MAIN COLUMN: VÄRDE & SÄLJ --- */}
        <div className={`relative p-8 md:p-12 flex flex-col justify-between overflow-hidden bg-gradient-to-br ${content.gradient}`}>
          
          {/* Background FX */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay"></div>
          <div className={`absolute top-0 right-0 w-80 h-80 opacity-10 rounded-full blur-[100px] pointer-events-none bg-white`}></div>
          
          <div className="relative z-10 text-center md:text-left">
            {/* Badge */}
            <div className={`inline-flex items-center gap-2 border px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-8 backdrop-blur-md ${content.badgeColor}`}>
              {isPremium ? <Crown className="w-3 h-3 fill-current" /> : <Lock className="w-3 h-3" />}
              {content.badge}
            </div>
            
            <h1 className="text-3xl md:text-4xl font-black text-white mb-6 leading-[1.1] tracking-tight font-heading">
              {content.displayTitle}
            </h1>
            
            <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-10 font-medium">
              {content.displayDesc}
            </p>

            {/* Feature List */}
            <div className="space-y-5 mb-10">
              {content.features.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 group">
                  <div className={`rounded-full p-1 shrink-0 bg-white/5 border border-white/5 group-hover:bg-white/10 transition-colors`}>
                    <Check className={`w-3 h-3 ${content.accent}`} />
                  </div>
                  <span className="font-bold text-slate-200 text-sm">{item}</span>
                </div>
              ))}
            </div>

            {/* --- CTA KNAPP --- */}
            <div className="pt-6 border-t border-white/10">
                <button
                    onClick={() => userEmail ? handleDirectPayment() : window.location.href = STRIPE_LINK}
                    disabled={isRedirecting}
                    className="group flex items-center justify-center gap-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-4 rounded-xl font-bold text-sm transition-all w-full backdrop-blur-sm"
                >
                    {isRedirecting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Skickas till kassan...</span>
                      </>
                    ) : (
                      <>
                        <span>Prova Premium Nu</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                </button>
                <div className="flex flex-col items-center mt-3 gap-1">
                  <p className="text-[10px] text-slate-400 font-medium">
                      Endast 99kr/mån. Ingen bindningstid.
                  </p>
                  
                  {/* DISKRET LÄNK FÖR MEDLEMMAR */}
                  <Link 
                    to="/profile" 
                    className="text-[10px] text-slate-500 hover:text-white transition-colors border-b border-transparent hover:border-white/20 pb-0.5 mt-2"
                  >
                    Redan medlem? Gå till mina sidor
                  </Link>
                </div>
            </div>

          </div>

          {/* Trust Footer */}
          <div className="relative z-10 mt-8 pt-6 border-t border-white/5 flex flex-wrap justify-center md:justify-start items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {isPremium ? (
               <>
                 <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Krypterad Betalning</span>
                 <span className="flex items-center gap-1.5"><Star className="w-3 h-3 text-amber-500" /> Nöjd-kund-garanti</span>
               </>
            ) : (
               <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-cyan-500" /> 100% Säker Data</span>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PremiumPaywall;
