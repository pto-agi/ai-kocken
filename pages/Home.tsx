import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  CalendarDays,
  LifeBuoy,
  LineChart,
  Sparkles,
  User,
  ShoppingBasket,
  BadgePercent
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const quickLinks = [
  {
    title: 'Veckomeny',
    description: 'Skapa kostschema, recept och inköpslista.',
    to: '/recept',
    icon: CalendarDays,
    tone: 'from-[#3D3D3D]/10 via-[#F29B7B]/12 to-transparent'
  },
  {
    title: 'Chatt',
    description: 'Lanseras i mars 2026.',
    to: '/support',
    icon: LifeBuoy,
    tone: 'from-[#3D3D3D]/10 via-[#F29B7B]/12 to-transparent'
  },
  {
    title: 'Uppföljning',
    description: 'Följ din utveckling och logga framsteg.',
    to: '/uppfoljning',
    icon: LineChart,
    tone: 'from-[#3D3D3D]/10 via-[#F29B7B]/12 to-transparent'
  },
  {
    title: 'Mina sidor',
    description: 'Hantera konto, veckomenyer och säkerhet.',
    to: '/profile',
    icon: User,
    tone: 'from-[#3D3D3D]/10 via-[#F29B7B]/12 to-transparent'
  },
  {
    title: 'Shop',
    description: 'Beställ kosttillskott till medlemspris.',
    to: '/refill',
    icon: ShoppingBasket,
    tone: 'from-[#3D3D3D]/10 via-[#F29B7B]/12 to-transparent'
  },
  {
    title: 'Förlängning',
    description: 'Förläng ditt medlemskap till klientpris.',
    to: '/forlangning',
    icon: BadgePercent,
    tone: 'from-[#3D3D3D]/10 via-[#F29B7B]/12 to-transparent'
  }
];

export const Home: React.FC = () => {
  const { session, profile } = useAuthStore();
  const firstName = profile?.full_name?.split(' ')[0];
  const isPremium = profile?.membership_level === 'premium';

  return (
    <div className="min-h-screen bg-[#F6F1E7] pb-20 animate-fade-in relative font-sans overflow-x-hidden text-[#3D3D3D]">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <section className="pt-8 md:pt-14">
          <div className="relative overflow-hidden rounded-[2.8rem] border border-[#DAD1C5] bg-white p-8 md:p-12 shadow-[0_35px_90px_rgba(61,61,61,0.2)] ring-1 ring-black/5">
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br from-[#E8F1D5] via-[#F6F1E7] to-white opacity-90" />
              <div className="absolute left-[-10%] top-[-30%] h-[420px] w-[420px] rounded-full bg-[#a0c81d]/15 blur-[130px]" />
              <div className="absolute right-[-20%] bottom-[-40%] h-[520px] w-[520px] rounded-full bg-[#F6F1E7]/90 blur-[160px]" />
              <div className="absolute inset-0 opacity-[0.25] [background-image:radial-gradient(rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:26px_26px]" />
            </div>

            <div className="relative z-10 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-[#6B6158]">
                <span className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-[#a0c81d]" /> Snabb översikt</span>
                {session && (
                  <span className={`px-3 py-1 rounded-full border ${isPremium ? 'border-emerald-400/40 text-emerald-300' : 'border-[#E6E1D8] text-[#6B6158]'} bg-[#ffffff]/70`}>
                    {isPremium ? 'Premium aktiv' : 'Medlemskap'}
                  </span>
                )}
              </div>
              <h1 className="mt-6 text-3xl md:text-5xl font-black text-[#3D3D3D] font-heading tracking-tight">
                {session ? `Välkommen tillbaka${firstName ? `, ${firstName}` : ''}.` : 'Välkommen till dina medlemssidor.'}
              </h1>
              <p className="mt-4 text-[#6B6158] text-sm md:text-base font-medium">
                Här är en snabb översikt över det viktigaste du kan göra i appen.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#6B6158]">
                {[
                  'AI‑coach för träning, kost och snabba frågor',
                  'Veckomeny med recept och inköpslista',
                  'Uppföljning av mål och framsteg',
                  'Chatt som öppnar i mars 2026',
                  'Shop med medlemspris',
                  'Förlängning av medlemskap'
                ].map((text) => (
                  <div key={text} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#a0c81d] mt-0.5 shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/recept"
                  className="inline-flex items-center gap-2 rounded-full bg-[#a0c81d] px-6 py-3 text-xs font-black uppercase tracking-widest text-[#F6F1E7] transition-all hover:bg-[#5C7A12] shadow-[0_18px_40px_rgba(160,200,29,0.35)] hover:shadow-[0_22px_50px_rgba(92,122,18,0.45)]"
                >
                  Skapa veckomeny <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/support"
                className="inline-flex items-center gap-2 rounded-full border border-[#E6E1D8] bg-white/80 px-6 py-3 text-xs font-black uppercase tracking-widest text-[#3D3D3D] transition-all hover:border-[#a0c81d]/40 hover:text-[#a0c81d] shadow-[0_10px_28px_rgba(61,61,61,0.12)] hover:shadow-[0_16px_36px_rgba(61,61,61,0.18)]"
              >
                  Öppna chatt
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-[#3D3D3D] font-heading tracking-tight">Snabbnavigering</h2>
              <p className="text-[#6B6158] text-sm font-medium mt-2">Gå direkt till det du vill göra idag.</p>
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#8A8177] font-black">Mina verktyg</div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {quickLinks.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="group relative overflow-hidden rounded-[2rem] border border-[#DAD1C5] bg-white p-6 ring-1 ring-black/5 transition-all hover:-translate-y-1.5 hover:border-[#a0c81d]/50 hover:ring-[#a0c81d]/25 shadow-[0_18px_50px_rgba(61,61,61,0.16)] hover:shadow-[0_28px_70px_rgba(61,61,61,0.22)] before:absolute before:inset-0 before:rounded-[2rem] before:shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] before:pointer-events-none"
              >
                <div className={`absolute inset-0 opacity-55 bg-gradient-to-br ${item.tone}`} />
                <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/80 to-transparent" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffffff]/90 border border-[#E6E1D8]">
                      <item.icon className="w-6 h-6 text-[#F29B7B] group-hover:text-[#a0c81d] transition-colors" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-[#6B6158] group-hover:text-[#a0c81d] group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="mt-6 text-lg font-black text-[#3D3D3D] font-heading tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm text-[#6B6158] font-medium">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
