import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
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
    tone: 'from-[#a0c81d]/20 via-[#a0c81d]/5 to-transparent'
  },
  {
    title: 'Support',
    description: 'Chatta med teamet och få snabb hjälp.',
    to: '/support',
    icon: LifeBuoy,
    tone: 'from-white/10 via-white/5 to-transparent'
  },
  {
    title: 'Uppföljning',
    description: 'Följ din utveckling och logga framsteg.',
    to: '/uppfoljning',
    icon: LineChart,
    tone: 'from-sky-500/15 via-sky-500/5 to-transparent'
  },
  {
    title: 'Mina sidor',
    description: 'Hantera konto, veckomenyer och säkerhet.',
    to: '/profile',
    icon: User,
    tone: 'from-emerald-500/15 via-emerald-500/5 to-transparent'
  },
  {
    title: 'Påfyllning',
    description: 'Beställ kosttillskott till medlemspris.',
    to: '/refill',
    icon: ShoppingBasket,
    tone: 'from-amber-500/15 via-amber-500/5 to-transparent'
  },
  {
    title: 'Förlängning',
    description: 'Förläng ditt medlemskap till klientpris.',
    to: '/forlangning',
    icon: BadgePercent,
    tone: 'from-purple-500/15 via-purple-500/5 to-transparent'
  }
];

export const Home: React.FC = () => {
  const { session, profile } = useAuthStore();
  const firstName = profile?.full_name?.split(' ')[0];
  const isPremium = profile?.membership_level === 'premium';

  return (
    <div className="min-h-screen bg-[#0f172a] pb-20 animate-fade-in relative font-sans overflow-x-hidden text-slate-200">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        <section className="pt-8 md:pt-14">
          <div className="relative overflow-hidden rounded-[2.8rem] border border-white/5 bg-gradient-to-br from-[#121a2b] via-[#0f172a] to-[#0b1020] p-8 md:p-12">
            <div className="absolute inset-0">
              <div className="absolute left-[-10%] top-[-30%] h-[420px] w-[420px] rounded-full bg-[#a0c81d]/15 blur-[130px]" />
              <div className="absolute right-[-20%] bottom-[-40%] h-[520px] w-[520px] rounded-full bg-white/5 blur-[160px]" />
              <div className="absolute inset-0 opacity-[0.2] [background-image:radial-gradient(rgba(148,163,184,0.25)_1px,transparent_1px)] [background-size:26px_26px]" />
            </div>

            <div className="relative z-10 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                <span className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-[#a0c81d]" /> Medlemsstart</span>
                {session && (
                  <span className={`px-3 py-1 rounded-full border ${isPremium ? 'border-emerald-400/40 text-emerald-300' : 'border-white/10 text-slate-400'} bg-white/5`}>
                    {isPremium ? 'Premium aktiv' : 'Medlemskap'}
                  </span>
                )}
              </div>
              <h1 className="mt-6 text-3xl md:text-5xl font-black text-white font-heading tracking-tight">
                {session ? `Välkommen tillbaka${firstName ? `, ${firstName}` : ''}.` : 'Välkommen till dina medlemssidor.'}
              </h1>
              <p className="mt-4 text-slate-300 text-sm md:text-base font-medium">
                Bygg din veckomeny, följ upp framsteg och få snabb hjälp från supporten. Härifrån når du allt som är viktigt för din resa.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/recept"
                  className="inline-flex items-center gap-2 rounded-full bg-[#a0c81d] px-6 py-3 text-xs font-black uppercase tracking-widest text-[#0f172a] transition-all hover:bg-[#b5e02e]"
                >
                  Skapa veckomeny <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/support"
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:border-[#a0c81d]/40 hover:text-[#a0c81d]"
                >
                  Chatta med support
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white font-heading tracking-tight">Snabbnavigering</h2>
              <p className="text-slate-400 text-sm font-medium mt-2">Gå direkt till det du vill göra idag.</p>
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">Mina verktyg</div>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {quickLinks.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="group relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#0f172a]/80 p-6 transition-all hover:-translate-y-1 hover:border-[#a0c81d]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
              >
                <div className={`absolute inset-0 opacity-70 bg-gradient-to-br ${item.tone}`} />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10">
                      <item.icon className="w-6 h-6 text-[#a0c81d]" />
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-[#a0c81d] group-hover:translate-x-1 transition-all" />
                  </div>
                  <h3 className="mt-6 text-lg font-black text-white font-heading tracking-tight">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-400 font-medium">{item.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
