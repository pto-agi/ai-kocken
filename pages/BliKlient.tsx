import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dumbbell, Utensils, BarChart3, Smartphone, MessageCircle,
  ChevronDown, ArrowRight, Star, Shield, Zap, Home,
  Users, Award, Clock, Lock, CheckCircle2, Undo2,
} from 'lucide-react';

import { CheckoutHeader } from '../components/checkout/CheckoutHeader';

// ── GTM dataLayer helper ──

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function pushEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
  }
}

// ── Data ──

const FEATURES = [
  {
    icon: Dumbbell,
    title: 'Personlig coach',
    desc: 'Ett skräddarsytt träningsprogram anpassat efter dina mål, vardag och förutsättningar.',
  },
  {
    icon: Utensils,
    title: 'AI-drivna veckomenyer',
    desc: 'Veckomeny med recept, inköpslista och makron — genererad efter dina preferenser.',
  },
  {
    icon: BarChart3,
    title: 'Uppföljning varje månad',
    desc: 'Regelbunden checkin och ny planering så att du alltid rör dig framåt.',
  },
  {
    icon: Smartphone,
    title: 'Allt i en app',
    desc: 'Träning, kost och kontakt med ditt team — samlat direkt i mobilen.',
  },
  {
    icon: MessageCircle,
    title: 'Direkt kontakt',
    desc: 'Chatt med ditt team för snabb hjälp och motivation när du behöver det.',
  },
  {
    icon: Clock,
    title: 'Flexibelt upplägg',
    desc: 'Välj paket eller månadsvis. Ingen bindningstid — avsluta när du vill.',
  },
];

const USP_BULLETS = [
  { icon: Users, text: 'Över 30 000 nöjda klienter sedan 2012' },
  { icon: CheckCircle2, text: 'Priset gäller för hela perioden' },
  { icon: Zap, text: 'Inga månadsavgifter eller bindningstider' },
  { icon: Home, text: 'Träna hemma, utomhus eller på gym' },
  { icon: Undo2, text: '14 dagars ångerrätt' },
  { icon: Award, text: 'Godkänt för friskvårdsbidrag' },
];

const HOW_IT_WORKS = [
  { step: '1', title: 'Välj plan & betala', desc: 'Välj ett paket eller månadsvis coaching. Betala med kort, Klarna, Apple Pay eller friskvårdsbidrag.' },
  { step: '2', title: 'Din coach hör av sig', desc: 'Du väljer själv önskat startdatum. Din nya coach kontaktar dig inom 24 timmar.' },
  { step: '3', title: 'Kom igång', desc: 'Fyll i ditt startformulär, få ditt skräddarsydda program och börja direkt.' },
];

const FAQ = [
  {
    q: 'Vad ingår?',
    a: 'Personlig coach, skräddarsytt tränings- och kostschema, AI-drivna veckomenyer, regelbunden uppföljning och ny planering varje månad. Allt samlat i en app.',
  },
  {
    q: 'Hur avslutar jag?',
    a: 'Månadsvis avslutar du när du vill, utan bindningstid. Paket löper ut automatiskt vid periodens slut — inga dolda avgifter.',
  },
  {
    q: 'Fungerar det med friskvårdsbidrag?',
    a: 'Ja! Välj "Friskvårdsbidrag" som betalmetod i kassan. Du kan betala hela eller delar via din arbetsgivares friskvårdsportal.',
  },
  {
    q: 'När kan jag börja?',
    a: 'Du väljer själv önskat startdatum och kan börja när du vill. När du slutfört din anmälan så har du kontakt med din nya coach inom 24 timmar.',
  },
  {
    q: 'Hur snabbt kommer jag igång?',
    a: 'Direkt efter betalning. Du får ett välkomstmejl med instruktioner, fyller i startformuläret och ditt team börjar jobba på din plan.',
  },
];

const PRICING_PREVIEW = [
  { label: '3 månader', price: '1 995', per: '665 kr/mån', popular: false, id: '3m' },
  { label: '6 månader', price: '2 995', per: '499 kr/mån', popular: true, id: '6m' },
  { label: '12 månader', price: '3 995', per: '333 kr/mån', popular: false, id: '12m' },
  { label: 'Månadsvis', price: '495', per: 'kr/mån', popular: false, id: 'monthly' },
];

// ── CTA Button ──

const CtaButton: React.FC<{ className?: string; label?: string; eventName?: string }> = ({
  className = '',
  label = 'Kom igång nu',
  eventName = 'cta_click',
}) => {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        pushEvent(eventName, { page: 'bli-klient', label });
        navigate('/checkout');
      }}
      className={`
        inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl
        bg-[#a0c81d] text-white font-black text-sm uppercase tracking-widest
        hover:bg-[#8ab516] hover:shadow-xl hover:shadow-[#a0c81d]/25
        active:scale-[0.97] transition-all duration-200
        shadow-lg shadow-[#a0c81d]/15
        ${className}
      `}
    >
      {label}
      <ArrowRight className="w-4 h-4" />
    </button>
  );
};

// ── Page ──

export const BliKlient: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // GA4: page_view event
  useEffect(() => {
    pushEvent('page_view', {
      page_title: 'Bli klient',
      page_location: window.location.href,
      page_path: '/bli-klient',
    });
    pushEvent('view_item_list', {
      item_list_name: 'bli-klient-pricing',
      items: PRICING_PREVIEW.map((p) => ({
        item_id: p.id,
        item_name: p.label,
        price: parseFloat(p.price.replace(/\s/g, '')),
        currency: 'SEK',
      })),
    });
  }, []);

  const handleFaqToggle = useCallback((i: number) => {
    setOpenFaq((prev) => {
      const next = prev === i ? null : i;
      if (next !== null) {
        pushEvent('faq_click', { question: FAQ[i].q });
      }
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#F6F1E7]">
      <CheckoutHeader />

      {/* ═══ HERO ═══ */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#a0c81d]/[0.05] rounded-full blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          {/* Social proof badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-[#E6E1D8] px-4 py-1.5 mb-6 backdrop-blur-sm">
            <div className="flex -space-x-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              ))}
            </div>
            <span className="text-xs font-bold text-[#3D3D3D]">
              Över 30 000 nöjda klienter sedan 2012
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#3D3D3D] leading-[1.1] mb-4 tracking-tight">
            Din personliga coach.
            <br />
            <span className="text-[#a0c81d]">I fickan.</span>
          </h1>

          <p className="text-base md:text-lg text-[#6B6158] font-medium max-w-xl mx-auto mb-4 leading-relaxed">
            Skräddarsytt träningsprogram, AI-drivna veckomenyer och personlig uppföljning — allt samlat i en app.
          </p>

          <p className="text-sm text-[#3D3D3D] font-bold mb-8">
            Du väljer själv önskat startdatum och kan börja när du vill.
            <br className="hidden sm:block" />
            {' '}Din nya coach kontaktar dig inom 24 timmar.
          </p>

          <CtaButton label="Bli klient" eventName="hero_cta_click" />

          {/* Trust strip */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-8 text-[10px] font-bold text-[#8A8177] uppercase tracking-wider">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Säker betalning</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Ingen bindningstid</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Friskvårdsgodkänd</span>
          </div>
        </div>
      </section>

      {/* ═══ USP BULLETS ═══ */}
      <section className="py-12 px-4 bg-white/40">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {USP_BULLETS.map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-3 rounded-2xl bg-white border border-[#E6E1D8] px-4 py-3.5"
              >
                <div className="w-8 h-8 rounded-lg bg-[#f5fae6] flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#6B8A12]" />
                </div>
                <span className="text-xs font-bold text-[#3D3D3D]">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ WHAT'S INCLUDED ═══ */}
      <section className="py-16 md:py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#a0c81d] mb-2">
              Det här ingår
            </h2>
            <p className="text-xl md:text-2xl font-black text-[#3D3D3D]">
              Allt du behöver. Inget du inte behöver.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="
                  rounded-2xl bg-white border border-[#E6E1D8] p-5
                  hover:border-[#a0c81d]/40 hover:shadow-lg hover:shadow-[#a0c81d]/[0.06]
                  transition-all duration-300 group
                "
              >
                <div className="w-10 h-10 rounded-xl bg-[#f5fae6] flex items-center justify-center mb-3 group-hover:bg-[#a0c81d]/15 transition-colors">
                  <Icon className="w-5 h-5 text-[#6B8A12]" />
                </div>
                <h3 className="text-sm font-bold text-[#3D3D3D] mb-1">{title}</h3>
                <p className="text-xs text-[#6B6158] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-16 md:py-20 px-4 bg-white/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#a0c81d] mb-2">
              Så fungerar det
            </h2>
            <p className="text-xl md:text-2xl font-black text-[#3D3D3D]">
              Tre steg. Sedan kör vi.
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            {HOW_IT_WORKS.map(({ step, title, desc }, i) => (
              <div key={step} className="flex-1 relative">
                <div className="rounded-2xl bg-white border border-[#E6E1D8] p-5 text-center h-full">
                  <div className="w-10 h-10 rounded-full bg-[#a0c81d] text-white font-black text-sm flex items-center justify-center mx-auto mb-3">
                    {step}
                  </div>
                  <h3 className="text-sm font-bold text-[#3D3D3D] mb-1">{title}</h3>
                  <p className="text-xs text-[#6B6158] leading-relaxed">{desc}</p>
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-2 -translate-y-1/2 z-10">
                    <div className="w-4 h-4 rounded-full bg-[#E6E1D8] flex items-center justify-center">
                      <ChevronDown className="w-3 h-3 text-[#8A8177] -rotate-90" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING PREVIEW ═══ */}
      <section className="py-16 md:py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#a0c81d] mb-2">
              Enkla priser
            </h2>
            <p className="text-xl md:text-2xl font-black text-[#3D3D3D]">
              Priset gäller för hela perioden
            </p>
            <p className="text-sm text-[#6B6158] font-medium mt-2">
              Inga dolda avgifter. Inga bindningstider.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {PRICING_PREVIEW.map(({ label, price, per, popular, id }) => (
              <button
                type="button"
                key={label}
                onClick={() => {
                  pushEvent('select_item', {
                    item_list_name: 'bli-klient-pricing',
                    items: [{ item_id: id, item_name: label, price: parseFloat(price.replace(/\s/g, '')), currency: 'SEK' }],
                  });
                  window.location.href = '/checkout';
                }}
                className={`
                  rounded-2xl p-5 text-center relative border transition-all cursor-pointer
                  ${popular
                    ? 'bg-[#3D3D3D] border-[#3D3D3D] text-white shadow-xl shadow-black/10 hover:bg-[#2d2d2d]'
                    : 'bg-white border-[#E6E1D8] hover:border-[#a0c81d]/40 hover:shadow-md'
                  }
                `}
              >
                {popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#a0c81d] text-white text-[9px] font-black uppercase tracking-wider">
                    Populärast
                  </div>
                )}
                <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${popular ? 'text-white/60' : 'text-[#8A8177]'}`}>
                  {label}
                </p>
                <p className="text-2xl font-black mb-1">
                  {price} <span className="text-sm font-bold">kr</span>
                </p>
                <p className={`text-[10px] font-medium ${popular ? 'text-white/50' : 'text-[#8A8177]'}`}>
                  {per}
                </p>
              </button>
            ))}
          </div>

          <div className="text-center">
            <CtaButton label="Välj plan & kom igång" eventName="pricing_cta_click" />
          </div>
        </div>
      </section>

      {/* ═══ TRUST SIGNALS ═══ */}
      <section className="py-12 px-4 bg-white/40">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Shield, label: 'Krypterad betalning', sub: 'via Stripe' },
              { icon: Undo2, label: '14 dagars ångerrätt', sub: 'riskfritt' },
              { icon: Users, label: '30 000+ klienter', sub: 'sedan 2012' },
              { icon: Award, label: 'Friskvårdsgodkänd', sub: 'av Skatteverket' },
            ].map(({ icon: Icon, label, sub }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-white border border-[#E6E1D8] p-4 text-center"
              >
                <Icon className="w-5 h-5 text-[#a0c81d]" />
                <span className="text-[10px] font-black text-[#3D3D3D] uppercase tracking-wider">{label}</span>
                <span className="text-[9px] text-[#8A8177] font-medium">{sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-16 md:py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#a0c81d] mb-2">
              Vanliga frågor
            </h2>
            <p className="text-xl md:text-2xl font-black text-[#3D3D3D]">
              Har du en fråga?
            </p>
          </div>

          <div className="space-y-2">
            {FAQ.map(({ q, a }, i) => (
              <div
                key={q}
                className="rounded-2xl border border-[#E6E1D8] bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => handleFaqToggle(i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-bold text-[#3D3D3D] pr-4">{q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#8A8177] flex-shrink-0 transition-transform duration-200 ${
                      openFaq === i ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFaq === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="px-5 pb-4 text-xs text-[#6B6158] font-medium leading-relaxed">
                    {a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ BOTTOM CTA ═══ */}
      <section className="py-16 md:py-20 px-4 bg-white/40">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-black text-[#3D3D3D] mb-3">
            Redo att börja?
          </h2>
          <p className="text-sm text-[#6B6158] font-medium mb-2">
            Välj plan, betala enkelt och kom igång direkt. Ditt team väntar.
          </p>
          <p className="text-xs text-[#8A8177] mb-6">
            14 dagars ångerrätt · Ingen bindningstid · Friskvårdsgodkänd
          </p>
          <CtaButton label="Bli klient" eventName="bottom_cta_click" />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-[#E6E1D8]/60 text-center">
        <p className="text-[10px] text-[#8A8177] font-medium">
          © {new Date().getFullYear()} Private Training Online · Org.nr 559387-3108 ·{' '}
          <a href="https://www.privatetrainingonline.se" className="underline hover:text-[#3D3D3D] transition">
            privatetrainingonline.se
          </a>
        </p>
      </footer>
    </div>
  );
};

export default BliKlient;
