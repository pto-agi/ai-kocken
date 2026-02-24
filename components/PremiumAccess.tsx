import React from 'react';
import { ArrowRight, CheckCircle2, Crown, Sparkles, ShieldCheck, Timer, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PremiumAccessProps {
  mode?: 'locked' | 'logged_out';
  title?: string;
  description?: string;
}

const PAYMENT_URL = 'https://betalning.privatetrainingonline.se/b/cNi00i4bN9lBaqO4sDcfK0v?locale=sv';

const PremiumAccess: React.FC<PremiumAccessProps> = ({
  mode = 'locked',
  title,
  description
}) => {
  const isLoggedOut = mode === 'logged_out';

  const copy = {
    locked: {
      badge: 'Premium krävs',
      title: title || 'Lås upp hela My PTO.',
      desc: description || 'Den här funktionen är exklusiv för Premium-medlemmar. Aktivera för att få full tillgång direkt.'
    },
    loggedOut: {
      badge: 'Logga in eller bli medlem',
      title: title || 'Skapa konto och aktivera Premium.',
      desc: description || 'Logga in för att koppla ditt köp till ditt konto och få tillgång till premiumfunktioner direkt.'
    }
  }[isLoggedOut ? 'loggedOut' : 'locked'];

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16 animate-fade-in-up font-sans">
      <div className="relative max-w-5xl w-full overflow-hidden rounded-[2.8rem] border border-[#E6E1D8] bg-[#F6F1E7] shadow-2xl">
        <div className="absolute -top-24 -right-20 w-[420px] h-[420px] bg-[#a0c81d]/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-24 -left-24 w-[460px] h-[460px] bg-emerald-500/10 blur-[140px] rounded-full"></div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-0">
          <div className="p-8 md:p-12 lg:p-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E6E1D8] bg-[#ffffff]/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158]">
              <Crown className="w-3 h-3 text-[#a0c81d]" />
              {copy.badge}
            </div>

            <h1 className="mt-6 text-3xl md:text-4xl font-black text-[#3D3D3D] font-heading tracking-tight">
              {copy.title}
            </h1>
            <p className="mt-4 text-[#6B6158] text-sm md:text-base font-medium max-w-xl">
              {copy.desc}
            </p>

            <div className="mt-8 space-y-4 text-sm text-[#6B6158]">
              {[
                'AI-recept, veckomenyer och inköpslistor i realtid.',
                'Full kostkalibrering och personliga mål.',
                'Spara planer, favoritmåltider och följ utveckling.',
                'Premium-uppgradering sker automatiskt efter betalning.'
              ].map((text) => (
                <div key={text} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#a0c81d] mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <a
                href={PAYMENT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#a0c81d] text-[#F6F1E7] px-6 py-4 text-xs font-black uppercase tracking-widest transition-all hover:bg-[#5C7A12]"
              >
                Aktivera Premium
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                to="/auth"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E6E1D8] bg-[#ffffff]/70 text-[#3D3D3D] px-6 py-4 text-xs font-black uppercase tracking-widest transition-all hover:bg-[#ffffff]/95"
              >
                Logga in / Skapa konto
              </Link>
            </div>

            <div className="mt-6 text-[10px] text-[#8A8177] font-bold uppercase tracking-widest">
              Betalning sker säkert via Stripe Checkout
            </div>
          </div>

          <div className="p-8 md:p-12 lg:p-14 bg-[#eadfd9] border-t border-[#E6E1D8] lg:border-t-0 lg:border-l border-[#E6E1D8]">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-[#a0c81d]/10 border border-[#a0c81d]/30 flex items-center justify-center text-[#a0c81d]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Så funkar det</p>
                <h2 className="text-2xl font-black text-[#3D3D3D]">Kom igång på 2 minuter</h2>
              </div>
            </div>

            <div className="space-y-5 text-sm text-[#6B6158]">
              {[
                {
                  icon: UserCheck,
                  title: '1. Logga in',
                  desc: 'Använd samma e-post som du tänker betala med.'
                },
                {
                  icon: ShieldCheck,
                  title: '2. Betala tryggt',
                  desc: 'Du skickas till Stripe Checkout och får kvitto direkt.'
                },
                {
                  icon: Timer,
                  title: '3. Premium aktiveras',
                  desc: 'Premium‑claims uppdateras automatiskt i din profil.'
                }
              ].map((step) => (
                <div key={step.title} className="flex items-start gap-4 rounded-2xl border border-[#E6E1D8] bg-[#ffffff]/70 p-4">
                  <div className="w-10 h-10 rounded-xl bg-[#ffffff]/80 flex items-center justify-center text-[#a0c81d]">
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-black text-[#3D3D3D]">{step.title}</p>
                    <p className="text-xs text-[#6B6158] mt-1">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-xs text-[#6B6158]">
              Redan betalat? Logga in igen så uppdateras din åtkomst automatiskt.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PremiumAccess;
