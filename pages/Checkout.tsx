import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import type { Appearance } from '@stripe/stripe-js';
import {
  Loader2, AlertTriangle, Receipt, Lock,
  Dumbbell, Utensils, BarChart3, Smartphone, MessageCircle,
  ChevronDown, ArrowDown, Star, Shield, CreditCard, Zap,
  CheckCircle2, Users, Award, Clock,
} from 'lucide-react';

import { CHECKOUT_PLANS, DEFAULT_PLAN_ID, getPlanById } from '../lib/checkoutPlans';
import { createIntent } from '../utils/checkoutClient';
import { trackCheckoutEvent } from '../utils/paymentAnalytics';
import { useAuthStore } from '../store/authStore';

import { CheckoutHeader } from '../components/checkout/CheckoutHeader';
import { PlanSelector } from '../components/checkout/PlanSelector';
import { CheckoutForm } from '../components/checkout/CheckoutForm';

// ── Stripe Appearance ──

const PTO_APPEARANCE: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#a0c81d',
    colorBackground: '#ffffff',
    colorText: '#3D3D3D',
    colorDanger: '#df1b41',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    borderRadius: '12px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': {
      border: '1px solid #E6E1D8',
      boxShadow: 'none',
      padding: '12px 14px',
    },
    '.Input:focus': {
      border: '1px solid #a0c81d',
      boxShadow: '0 0 0 1px #a0c81d',
    },
    '.Label': {
      color: '#6B6158',
      fontSize: '12px',
      fontWeight: '700',
      textTransform: 'uppercase' as any,
      letterSpacing: '0.05em',
    },
    '.Tab': {
      border: '1px solid #E6E1D8',
      borderRadius: '12px',
    },
    '.Tab--selected': {
      border: '1px solid #a0c81d',
      backgroundColor: '#f5fae6',
    },
  },
};

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

const HOW_IT_WORKS = [
  { step: '1', title: 'Välj plan', desc: 'Bestäm dig för ett paket eller månadsvis coaching.' },
  { step: '2', title: 'Betala enkelt', desc: 'Snabb betalning med kort, Klarna, Apple Pay eller friskvård.' },
  { step: '3', title: 'Kom igång', desc: 'Du får instruktioner direkt — skicka in ditt startformulär och börja.' },
];

const FAQ = [
  {
    q: 'Vad ingår i ett medlemskap?',
    a: 'Personlig coach, skräddarsytt tränings- och kostschema, AI-drivna veckomenyer, regelbunden uppföljning och ny planering varje månad. Allt samlat i en app.',
  },
  {
    q: 'Hur avslutar jag?',
    a: 'Månadsvis avslutar du när du vill, utan bindningstid. Paket löper ut automatiskt vid periodens slut — inga dolda avgifter.',
  },
  {
    q: 'Fungerar det med friskvårdsbidrag?',
    a: 'Ja! Välj "Friskvårdsbidrag" som betalmetod. Du kan betala hela eller delar via din arbetsgivares friskvårdsportal.',
  },
  {
    q: 'Kan jag testa först?',
    a: 'Vi erbjuder inget gratis provabonnemang, men du kan starta med ett 3-månaderspaket och se hur det fungerar för dig.',
  },
  {
    q: 'Hur snabbt kommer jag igång?',
    a: 'Direkt efter betalning. Du får ett välkomstmejl med instruktioner, fyller i startformuläret och ditt team börjar jobba på din plan.',
  },
];

// ── Types ──

type CheckoutState =
  | { phase: 'selecting' }
  | { phase: 'loading' }
  | { phase: 'ready'; clientSecret: string; publishableKey: string; mode: 'payment' | 'subscription' }
  | { phase: 'error'; message: string }
  | { phase: 'friskvard' };

// ── Page ──

export const Checkout: React.FC = () => {
  const { session, profile } = useAuthStore();
  const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_PLAN_ID);
  const [state, setState] = useState<CheckoutState>({ phase: 'selecting' });
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'friskvard'>('stripe');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);

  const plan = useMemo(() => getPlanById(selectedPlanId) || CHECKOUT_PLANS[0], [selectedPlanId]);

  useEffect(() => {
    if (session?.user?.email && !email) setEmail(session.user.email);
    if (profile?.full_name && !fullName) setFullName(profile.full_name);
  }, [session, profile]);

  useEffect(() => {
    trackCheckoutEvent('checkout_started', { flow: 'checkout', mode: plan.mode });
  }, []);

  const scrollToCheckout = () => {
    checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePlanSelect = useCallback((planId: string) => {
    setSelectedPlanId(planId);
    setState({ phase: 'selecting' });
  }, []);

  const handleStartPayment = useCallback(async () => {
    if (!email.trim()) {
      setState({ phase: 'error', message: 'Ange din e-postadress.' });
      return;
    }

    if (paymentMethod === 'friskvard') {
      setState({ phase: 'friskvard' });
      return;
    }

    setState({ phase: 'loading' });

    const response = await createIntent({
      planId: selectedPlanId,
      email: email.trim(),
      fullName: fullName.trim() || undefined,
      userId: session?.user?.id,
    }, session?.access_token);

    if (!response.ok || !response.clientSecret) {
      setState({
        phase: 'error',
        message: response.error || 'Kunde inte starta betalning. Försök igen.',
      });
      return;
    }

    setState({
      phase: 'ready',
      clientSecret: response.clientSecret,
      publishableKey: response.publishableKey!,
      mode: response.mode || plan.mode,
    });
  }, [email, fullName, selectedPlanId, paymentMethod, plan, session]);

  const stripePromise = useMemo(() => {
    if (state.phase !== 'ready') return null;
    return loadStripe(state.publishableKey);
  }, [state]);

  const returnUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/checkout/tack`
    : 'https://my.privatetrainingonline.se/checkout/tack';

  return (
    <div className="min-h-screen bg-[#F6F1E7]">
      <CheckoutHeader />

      {/* ╔══════════════════════════════════════════════╗
          ║  HERO — Above the fold                       ║
          ╚══════════════════════════════════════════════╝ */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24 px-4 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#a0c81d]/[0.05] rounded-full blur-[120px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 border border-[#E6E1D8] px-4 py-1.5 mb-6 backdrop-blur-sm">
            <div className="flex -space-x-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              ))}
            </div>
            <span className="text-xs font-bold text-[#3D3D3D]">
              4.9/5 · 500+ nöjda klienter
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#3D3D3D] leading-[1.1] mb-4 tracking-tight">
            Din personliga coach.
            <br />
            <span className="text-[#a0c81d]">I fickan.</span>
          </h1>

          <p className="text-base md:text-lg text-[#6B6158] font-medium max-w-lg mx-auto mb-8 leading-relaxed">
            Skräddarsytt träningsprogram, AI-drivna veckomenyer och personlig uppföljning — allt samlat i en app. Kom igång på 2 minuter.
          </p>

          <button
            type="button"
            onClick={scrollToCheckout}
            className="
              inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl
              bg-[#a0c81d] text-white font-black text-sm uppercase tracking-widest
              hover:bg-[#8ab516] hover:shadow-xl hover:shadow-[#a0c81d]/25
              active:scale-[0.97] transition-all duration-200
              shadow-lg shadow-[#a0c81d]/15
            "
          >
            Kom igång nu
            <ArrowDown className="w-4 h-4 animate-bounce" />
          </button>

          {/* Trust mini-strip */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-8 text-[10px] font-bold text-[#8A8177] uppercase tracking-wider">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Säker betalning</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Ingen bindningstid</span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Friskvårdsgodkänd</span>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════════════════╗
          ║  WHAT'S INCLUDED — Feature grid               ║
          ╚══════════════════════════════════════════════╝ */}
      <section className="py-16 md:py-20 px-4 bg-white/40">
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

      {/* ╔══════════════════════════════════════════════╗
          ║  HOW IT WORKS — 3 steps                      ║
          ╚══════════════════════════════════════════════╝ */}
      <section className="py-16 md:py-20 px-4">
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
                {/* Connector arrow (desktop only) */}
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

      {/* ╔══════════════════════════════════════════════╗
          ║  CHECKOUT — Plan selector + Payment           ║
          ╚══════════════════════════════════════════════╝ */}
      <section ref={checkoutRef} className="py-16 md:py-20 px-4 bg-white/40 scroll-mt-16" id="checkout">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#a0c81d] mb-2">
              Välj din plan
            </h2>
            <p className="text-xl md:text-2xl font-black text-[#3D3D3D]">
              Hitta rätt upplägg för dig
            </p>
          </div>

          {/* Plan selector */}
          <div className="mb-10">
            <PlanSelector
              plans={CHECKOUT_PLANS}
              selectedPlanId={selectedPlanId}
              onSelect={handlePlanSelect}
            />
          </div>

          {/* Payment card */}
          <div className="max-w-2xl mx-auto">
            {/* Selected plan summary */}
            <div className="rounded-2xl bg-gradient-to-br from-[#f5fae6] to-[#eef5d6] border border-[#d9e8a0] p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-widest text-[#6B8A12]">Din plan</span>
                <span className="text-xs text-[#8A8177] font-medium">{plan.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-[#3D3D3D]">{plan.price.toLocaleString('sv-SE')}</span>
                <span className="text-lg font-bold text-[#6B6158]">kr</span>
                {plan.mode === 'subscription' && <span className="text-sm text-[#8A8177] font-medium">/mån</span>}
              </div>
              {plan.mode === 'payment' && plan.perMonth && (
                <p className="text-xs text-[#6B8A12] font-medium mt-1">
                  Motsvarar {plan.perMonth.toLocaleString('sv-SE')} kr/mån
                </p>
              )}
            </div>

            {/* Payment form card */}
            <div className="rounded-3xl bg-white border border-[#E6E1D8] shadow-xl shadow-black/[0.04] p-6 md:p-8">
              {/* Payment method tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('stripe'); setState({ phase: 'selecting' }); }}
                  className={`
                    flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all
                    ${paymentMethod === 'stripe'
                      ? 'bg-[#3D3D3D] text-white shadow-md'
                      : 'bg-[#F6F1E7] text-[#6B6158] hover:bg-[#EDE8DD]'
                    }
                  `}
                >
                  💳 Kort / Klarna
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('friskvard'); setState({ phase: 'selecting' }); }}
                  className={`
                    flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all
                    ${paymentMethod === 'friskvard'
                      ? 'bg-[#3D3D3D] text-white shadow-md'
                      : 'bg-[#F6F1E7] text-[#6B6158] hover:bg-[#EDE8DD]'
                    }
                  `}
                >
                  🏥 Friskvårdsbidrag
                </button>
              </div>

              {/* Email & name inputs */}
              {(state.phase === 'selecting' || state.phase === 'error') && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-1.5">
                      E-post
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="din@email.se"
                      className="w-full px-4 py-3 rounded-xl border border-[#E6E1D8] bg-white text-sm text-[#3D3D3D] placeholder:text-[#C5BFB5] focus:outline-none focus:ring-2 focus:ring-[#a0c81d] focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-1.5">
                      Namn <span className="text-[#C5BFB5]">(valfritt)</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ditt namn"
                      className="w-full px-4 py-3 rounded-xl border border-[#E6E1D8] bg-white text-sm text-[#3D3D3D] placeholder:text-[#C5BFB5] focus:outline-none focus:ring-2 focus:ring-[#a0c81d] focus:border-transparent transition"
                    />
                  </div>

                  {state.phase === 'error' && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{state.message}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleStartPayment}
                    className="
                      w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest
                      bg-[#a0c81d] text-white
                      hover:bg-[#8ab516] hover:shadow-lg hover:shadow-[#a0c81d]/20
                      active:scale-[0.98] transition-all duration-200
                      flex items-center justify-center gap-2
                    "
                  >
                    {paymentMethod === 'friskvard' ? (
                      <>
                        <Receipt className="w-4 h-4" />
                        {plan.mode === 'subscription'
                          ? `Beställ friskvård · ${plan.price.toLocaleString('sv-SE')} kr/mån`
                          : `Beställ friskvård · ${plan.price.toLocaleString('sv-SE')} kr`}
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Fortsätt till betalning ·{' '}
                        {plan.mode === 'subscription'
                          ? `${plan.price.toLocaleString('sv-SE')} kr/mån`
                          : `${plan.price.toLocaleString('sv-SE')} kr`}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Loading */}
              {state.phase === 'loading' && (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-[#a0c81d] mx-auto" />
                    <p className="text-sm text-[#6B6158] font-medium">Förbereder betalning...</p>
                  </div>
                </div>
              )}

              {/* Payment Element */}
              {state.phase === 'ready' && stripePromise && (
                <Elements
                  key={`${state.mode}-${state.clientSecret}`}
                  stripe={stripePromise}
                  options={{
                    clientSecret: state.clientSecret,
                    locale: 'sv',
                    appearance: PTO_APPEARANCE,
                  }}
                >
                  <CheckoutForm
                    plan={plan}
                    email={email}
                    returnUrl={returnUrl}
                  />
                </Elements>
              )}

              {/* Friskvårdsbidrag */}
              {state.phase === 'friskvard' && (
                <div className="space-y-4 py-4">
                  <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5 space-y-3">
                    <h3 className="text-sm font-bold text-blue-900">
                      Betalning med friskvårdsbidrag
                    </h3>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Din beställning registreras direkt. Du får instruktioner via e-post om hur
                      du slutför betalningen via din arbetsgivares friskvårdsportal. Ditt
                      medlemskap aktiveras efter godkännande.
                    </p>
                    <div className="rounded-xl bg-white/80 border border-blue-200 p-3 space-y-1 text-xs text-blue-800">
                      <div className="flex justify-between">
                        <span className="font-medium">Plan:</span>
                        <span className="font-bold">{plan.label}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Belopp:</span>
                        <span className="font-bold">{plan.price.toLocaleString('sv-SE')} kr</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      setState({ phase: 'loading' });
                      try {
                        const response = await fetch('/api/payments/create-checkout-session', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
                          },
                          body: JSON.stringify({
                            flow: 'premium',
                            mode: 'subscription',
                            paymentMethod: 'friskvardsbidrag',
                            email, fullName,
                            userId: session?.user?.id,
                          }),
                        });
                        const data = await response.json();
                        if (data.ok && data.friskvard) {
                          window.location.href = '/tack-forlangning-friskvard';
                        } else {
                          setState({ phase: 'error', message: data.error || 'Kunde inte registrera friskvårdsbeställning.' });
                        }
                      } catch {
                        setState({ phase: 'error', message: 'Oväntat fel. Försök igen.' });
                      }
                    }}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Receipt className="w-4 h-4" />
                    Bekräfta friskvårdsbeställning
                  </button>

                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('stripe'); setState({ phase: 'selecting' }); }}
                    className="w-full py-2 text-xs text-[#8A8177] font-bold hover:text-[#3D3D3D] transition"
                  >
                    ← Byt till kort / Klarna
                  </button>
                </div>
              )}

              {/* Security note */}
              <p className="text-center text-[10px] text-[#8A8177] font-medium flex items-center justify-center gap-1 mt-4">
                <Lock className="w-3 h-3" />
                Krypterad betalning via Stripe · Dina uppgifter är skyddade
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ╔══════════════════════════════════════════════╗
          ║  TRUST SIGNALS — Social proof bar             ║
          ╚══════════════════════════════════════════════╝ */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Shield, label: 'Krypterad betalning', sub: 'via Stripe' },
              { icon: Zap, label: 'Ingen bindningstid', sub: 'avsluta när du vill' },
              { icon: Users, label: '500+ klienter', sub: 'sedan 2019' },
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

      {/* ╔══════════════════════════════════════════════╗
          ║  FAQ                                          ║
          ╚══════════════════════════════════════════════╝ */}
      <section className="py-16 md:py-20 px-4 bg-white/40">
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
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
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

      {/* ╔══════════════════════════════════════════════╗
          ║  BOTTOM CTA                                   ║
          ╚══════════════════════════════════════════════╝ */}
      <section className="py-16 md:py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-xl md:text-2xl font-black text-[#3D3D3D] mb-3">
            Redo att börja?
          </h2>
          <p className="text-sm text-[#6B6158] font-medium mb-6">
            Välj plan, betala enkelt och kom igång direkt. Ditt team väntar.
          </p>
          <button
            type="button"
            onClick={scrollToCheckout}
            className="
              inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl
              bg-[#a0c81d] text-white font-black text-sm uppercase tracking-widest
              hover:bg-[#8ab516] hover:shadow-xl hover:shadow-[#a0c81d]/25
              active:scale-[0.97] transition-all duration-200
              shadow-lg shadow-[#a0c81d]/15
            "
          >
            Välj plan & betala
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer mini */}
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

export default Checkout;
