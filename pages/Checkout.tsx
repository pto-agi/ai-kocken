import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import type { Appearance } from '@stripe/stripe-js';
import {
  Loader2, AlertTriangle, Receipt, Lock,
  Dumbbell, Utensils, BarChart3, Smartphone, MessageCircle,
  ChevronDown, ArrowRight, Star, Shield, CreditCard,
  CheckCircle2, Users, Award, Clock, Sparkles,
  ArrowDown, Heart, TrendingUp,
} from 'lucide-react';

import '../styles/checkout.css';
import { CHECKOUT_PLANS, DEFAULT_PLAN_ID, getPlanById } from '../lib/checkoutPlans';
import type { CheckoutPlan } from '../lib/checkoutPlans';
import { createIntent } from '../utils/checkoutClient';
import { trackCheckoutEvent } from '../utils/paymentAnalytics';
import { useAuthStore } from '../store/authStore';
import { CheckoutHeader } from '../components/checkout/CheckoutHeader';
import { CheckoutForm } from '../components/checkout/CheckoutForm';

// ── Stripe Appearance (PTO brand) ──

const PTO_APPEARANCE: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#a0c81d',
    colorBackground: '#ffffff',
    colorText: '#3D3D3D',
    colorDanger: '#df1b41',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    borderRadius: '14px',
    spacingUnit: '4px',
  },
  rules: {
    '.Input': { border: '1.5px solid #E6E1D8', boxShadow: 'none', padding: '14px 16px', fontSize: '14px' },
    '.Input:focus': { border: '1.5px solid #a0c81d', boxShadow: '0 0 0 3px rgba(160,200,29,0.1)' },
    '.Label': { color: '#6B6158', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' as any, letterSpacing: '0.08em' },
    '.Tab': { border: '1.5px solid #E6E1D8', borderRadius: '14px' },
    '.Tab--selected': { border: '1.5px solid #a0c81d', backgroundColor: '#f5fae6' },
  },
};

// ── Static Data ──

const FEATURES = [
  { icon: Dumbbell, title: 'Personlig coach', desc: 'Skräddarsytt program anpassat efter dina mål och vardag.' },
  { icon: Utensils, title: 'AI-veckomenyer', desc: 'Recept, inköpslista och makron — anpassat efter dina preferenser.' },
  { icon: BarChart3, title: 'Månatlig uppföljning', desc: 'Regelbunden analys och ny planering varje månad.' },
  { icon: Smartphone, title: 'Allt i en app', desc: 'Träning, kost och kontakt med ditt team i mobilen.' },
  { icon: MessageCircle, title: 'Chatt med ditt team', desc: 'Snabb hjälp och motivation när du behöver det.' },
  { icon: Clock, title: 'Flexibelt upplägg', desc: 'Ingen bindningstid — avsluta eller byt plan när du vill.' },
];

const STEPS = [
  { n: '1', title: 'Välj paket', desc: 'Bestäm dig för ett paket eller månadsvis coaching.' },
  { n: '2', title: 'Betala enkelt', desc: 'Kort, Klarna, Apple Pay eller friskvårdsbidrag.' },
  { n: '3', title: 'Kom igång', desc: 'Fyll i ditt startformulär — ditt team börjar direkt.' },
];

const TESTIMONIALS = [
  { name: 'Sara L.', text: 'Bästa investeringen jag gjort för min hälsa. Coachen anpassar allt efter min vardag.', period: 'Klient sedan 2024' },
  { name: 'Erik J.', text: 'Veckomenyer och inköpslistor sparar mig timmar varje vecka. Helt sjukt smidigt.', period: 'Klient sedan 2023' },
  { name: 'Amanda K.', text: 'Äntligen ett program som fungerar långsiktigt. Inga krash-dieter, bara resultat.', period: 'Klient sedan 2024' },
];

const FAQ = [
  { q: 'Vad ingår i ett medlemskap?', a: 'Personlig coach, skräddarsytt tränings- och kostprogram, AI-drivna veckomenyer med recept och inköpslistor, regelbunden uppföljning och ny planering varje månad. Allt samlat i en app.' },
  { q: 'Hur avslutar jag mitt medlemskap?', a: 'Månadsvis avslutar du när du vill — inga dolda avgifter. Paket löper ut automatiskt vid periodens slut utan automatisk förnyelse.' },
  { q: 'Går det att betala med friskvårdsbidrag?', a: 'Ja! Välj "Friskvårdsbidrag" som betalmetod. Du kan betala hela eller delar via din arbetsgivares friskvårdsportal. Vi är godkända av alla större leverantörer.' },
  { q: 'Hur snabbt kommer jag igång?', a: 'Direkt efter betalning. Du får ett välkomstmejl med instruktioner, fyller i ditt startformulär och ditt team börjar bygga din plan — oftast samma dag.' },
  { q: 'Kan jag byta plan?', a: 'Absolut. Du kan uppgradera, nedgradera eller byta mellan paket och månadsvis när som helst. Kontakta ditt team så ordnar vi det.' },
];

// ── Scroll Reveal Hook ──

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('co-visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
    );

    el.querySelectorAll('.co-reveal').forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  return ref;
}

// ── Type ──

type CheckoutState =
  | { phase: 'selecting' }
  | { phase: 'loading' }
  | { phase: 'ready'; clientSecret: string; publishableKey: string; mode: 'payment' | 'subscription' }
  | { phase: 'error'; message: string }
  | { phase: 'friskvard' };

// ═══════════════════════════════════════════════════
//  PAGE
// ═══════════════════════════════════════════════════

export const Checkout: React.FC = () => {
  const { session, profile } = useAuthStore();
  const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_PLAN_ID);
  const [state, setState] = useState<CheckoutState>({ phase: 'selecting' });
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'friskvard'>('stripe');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const checkoutRef = useRef<HTMLDivElement>(null);
  const containerRef = useScrollReveal();

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
      setState({ phase: 'error', message: 'Ange din e-postadress för att fortsätta.' });
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
      setState({ phase: 'error', message: response.error || 'Kunde inte starta betalning. Försök igen.' });
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

  // ── Render ──

  return (
    <div ref={containerRef} className="min-h-screen bg-brand-sand font-sans">
      <CheckoutHeader />

      {/* ═══════════════════════════════════════
          HERO
          ═══════════════════════════════════════ */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 px-5 overflow-hidden">
        {/* Floating orbs */}
        <div className="co-orb co-orb-1" />
        <div className="co-orb co-orb-2" />
        <div className="co-orb co-orb-3" />

        <div className="max-w-2xl mx-auto text-center relative z-10">
          {/* Social proof chip */}
          <div className="co-reveal inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-sm border border-brand-line px-4 py-2 mb-7">
            <div className="flex -space-x-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              ))}
            </div>
            <div className="w-px h-3 bg-brand-line" />
            <span className="text-xs font-bold text-brand-charcoal">
              500+ nöjda klienter
            </span>
          </div>

          <h1 className="co-reveal co-reveal-delay-1 text-[2rem] sm:text-4xl md:text-[2.75rem] font-black text-brand-charcoal leading-[1.1] tracking-tight mb-5">
            Personlig coaching.
            <br />
            <span className="co-gradient-text">Resultat som varar.</span>
          </h1>

          <p className="co-reveal co-reveal-delay-2 text-base md:text-lg text-brand-muted font-medium max-w-md mx-auto mb-9 leading-relaxed">
            Skräddarsytt träningsprogram, AI-drivna veckomenyer och din egna coach — samlat i en app. Kom igång på 2 minuter.
          </p>

          <div className="co-reveal co-reveal-delay-3 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={scrollToCheckout}
              className="co-btn-primary co-cta-pulse !w-auto !px-8 !rounded-2xl shadow-lg shadow-brand-green/20"
            >
              Kom igång nu
              <ArrowDown className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-brand-mutedLight font-semibold flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Ingen bindningstid · Friskvårdsgodkänd
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          SOCIAL PROOF STRIP
          ═══════════════════════════════════════ */}
      <section className="py-10 px-5 border-y border-brand-line/50 bg-white/30">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-5">
          {[
            { value: '500+', label: 'Aktiva klienter', icon: Users },
            { value: '4.9', label: 'Av 5 i betyg', icon: Star },
            { value: '98%', label: 'Rekommenderar oss', icon: Heart },
            { value: '5 år', label: 'Erfarenhet', icon: TrendingUp },
          ].map(({ value, label, icon: Icon }) => (
            <div key={label} className="co-reveal text-center">
              <Icon className="w-5 h-5 text-brand-green mx-auto mb-2" />
              <div className="text-xl font-black text-brand-charcoal">{value}</div>
              <div className="text-[10px] font-bold text-brand-mutedLight uppercase tracking-widest">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FEATURES
          ═══════════════════════════════════════ */}
      <section className="py-20 md:py-24 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="co-reveal text-center mb-12">
            <p className="co-section-label">Det här ingår</p>
            <h2 className="text-xl md:text-2xl font-black text-brand-charcoal">
              Allt du behöver för att nå dina mål
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className={`co-reveal co-reveal-delay-${Math.min(i + 1, 5)} co-feature-card`}>
                <div className="co-feature-icon mb-3">
                  <Icon className="w-5 h-5 text-[#6B8A12]" />
                </div>
                <h3 className="text-sm font-bold text-brand-charcoal mb-1">{title}</h3>
                <p className="text-xs text-brand-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TESTIMONIALS
          ═══════════════════════════════════════ */}
      <section className="py-20 md:py-24 px-5 bg-white/30">
        <div className="max-w-4xl mx-auto">
          <div className="co-reveal text-center mb-12">
            <p className="co-section-label">Vad våra klienter säger</p>
            <h2 className="text-xl md:text-2xl font-black text-brand-charcoal">
              Riktiga resultat. Riktiga människor.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESTIMONIALS.map(({ name, text, period }, i) => (
              <div key={name} className={`co-reveal co-reveal-delay-${i + 1} co-testimonial-card`}>
                <div className="flex items-center gap-3 mb-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-sage to-brand-line flex items-center justify-center text-sm font-black text-brand-charcoal">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-brand-charcoal">{name}</div>
                    <div className="text-[10px] text-brand-mutedLight font-medium">{period}</div>
                  </div>
                </div>
                <p className="text-xs text-brand-muted leading-relaxed relative z-10">{text}</p>
                <div className="flex gap-0.5 mt-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          HOW IT WORKS
          ═══════════════════════════════════════ */}
      <section className="py-20 md:py-24 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="co-reveal text-center mb-12">
            <p className="co-section-label">Så fungerar det</p>
            <h2 className="text-xl md:text-2xl font-black text-brand-charcoal">
              Tre steg. Sedan kör vi.
            </h2>
          </div>

          <div className="flex flex-col md:flex-row gap-5">
            {STEPS.map(({ n, title, desc }, i) => (
              <div key={n} className={`co-reveal co-reveal-delay-${i + 1} flex-1 ${i < STEPS.length - 1 ? 'co-step-connector' : ''}`}>
                <div className="bg-white border border-brand-line rounded-2xl p-5 text-center h-full">
                  <div className="co-step-number mx-auto mb-3">{n}</div>
                  <h3 className="text-sm font-bold text-brand-charcoal mb-1">{title}</h3>
                  <p className="text-xs text-brand-muted leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          CHECKOUT
          ═══════════════════════════════════════ */}
      <section
        ref={checkoutRef}
        className="py-20 md:py-24 px-5 bg-white/30 scroll-mt-16"
        id="checkout"
      >
        <div className="max-w-5xl mx-auto">
          <div className="co-reveal text-center mb-10">
            <p className="co-section-label">Välj din plan</p>
            <h2 className="text-xl md:text-2xl font-black text-brand-charcoal mb-2">
              Hitta rätt upplägg för dig
            </h2>
            <p className="text-sm text-brand-muted font-medium">
              Alla planer inkluderar samma tjänster. Välj den period som passar bäst.
            </p>
          </div>

          {/* ── Plan Selector ── */}
          <div className="max-w-2xl mx-auto mb-10 grid grid-cols-2 md:grid-cols-4 gap-3">
            {CHECKOUT_PLANS.map((p) => {
              const isSelected = p.id === selectedPlanId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePlanSelect(p.id)}
                  className="co-plan-card text-left"
                  data-selected={isSelected}
                >
                  {p.badge && <div className="co-badge-popular">{p.badge}</div>}

                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">
                        {p.label}
                      </span>
                      <div className="co-radio" data-checked={isSelected} />
                    </div>

                    <div className="flex items-baseline gap-0.5 mb-1">
                      <span className="text-2xl font-black text-brand-charcoal">
                        {p.price.toLocaleString('sv-SE')}
                      </span>
                      <span className="text-sm font-bold text-brand-muted">kr</span>
                      {p.mode === 'subscription' && (
                        <span className="text-xs text-brand-mutedLight font-medium">/mån</span>
                      )}
                    </div>

                    {p.perMonth && p.mode === 'payment' && (
                      <p className="text-[10px] text-brand-mutedLight font-medium">
                        {p.perMonth.toLocaleString('sv-SE')} kr/mån
                      </p>
                    )}

                    {p.savings && (
                      <div className="co-savings-tag mt-2">
                        <Sparkles className="w-3 h-3" />
                        {p.savings}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Payment Card ── */}
          <div className="max-w-lg mx-auto">
            {/* Selected plan summary */}
            <div className="co-reveal rounded-2xl bg-gradient-to-br from-[#f5fae6] to-[#eef5d6] border border-[#d4e49e] p-5 mb-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#6B8A12]">Din plan</span>
                <span className="text-xs text-brand-muted font-semibold">{plan.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-brand-charcoal">
                  {plan.price.toLocaleString('sv-SE')}
                </span>
                <span className="text-base font-bold text-brand-muted">kr</span>
                {plan.mode === 'subscription' && (
                  <span className="text-sm text-brand-mutedLight font-medium">/mån</span>
                )}
              </div>
              {plan.perMonth && plan.mode === 'payment' && (
                <p className="text-xs text-[#6B8A12] font-medium mt-0.5">
                  Motsvarar {plan.perMonth.toLocaleString('sv-SE')} kr/mån
                </p>
              )}
              {/* Included mini-list */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                {['Personlig coach', 'AI-veckomenyer', 'App-tillgång', 'Chatt'].map((item) => (
                  <span key={item} className="flex items-center gap-1 text-[10px] text-[#6B8A12] font-semibold">
                    <CheckCircle2 className="w-3 h-3" /> {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Payment form */}
            <div className="co-reveal co-payment-card p-6 md:p-8">
              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('stripe'); setState({ phase: 'selecting' }); }}
                  className="co-tab"
                  data-active={paymentMethod === 'stripe'}
                >
                  <CreditCard className="w-3.5 h-3.5" /> Kort / Klarna
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('friskvard'); setState({ phase: 'selecting' }); }}
                  className="co-tab"
                  data-active={paymentMethod === 'friskvard'}
                >
                  🏥 Friskvårdsbidrag
                </button>
              </div>

              {/* Selecting / Error phase */}
              {(state.phase === 'selecting' || state.phase === 'error') && (
                <div className="space-y-4 mb-5">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.1em] text-brand-mutedLight mb-1.5">
                      E-post
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="din@email.se"
                      className="co-input"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.1em] text-brand-mutedLight mb-1.5">
                      Namn <span className="text-brand-line">(valfritt)</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ditt namn"
                      className="co-input"
                      autoComplete="name"
                    />
                  </div>

                  {state.phase === 'error' && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-red-700 font-medium">{state.message}</span>
                    </div>
                  )}

                  <button type="button" onClick={handleStartPayment} className="co-btn-primary co-cta-pulse">
                    {paymentMethod === 'friskvard' ? (
                      <>
                        <Receipt className="w-4 h-4" />
                        Beställ med friskvård · {plan.price.toLocaleString('sv-SE')} kr
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Fortsätt till betalning · {plan.mode === 'subscription'
                          ? `${plan.price.toLocaleString('sv-SE')} kr/mån`
                          : `${plan.price.toLocaleString('sv-SE')} kr`}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Loading */}
              {state.phase === 'loading' && (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center space-y-3">
                    <Loader2 className="w-7 h-7 animate-spin text-brand-green mx-auto" />
                    <p className="text-sm text-brand-muted font-medium">Förbereder säker betalning…</p>
                  </div>
                </div>
              )}

              {/* Stripe Elements */}
              {state.phase === 'ready' && stripePromise && (
                <Elements
                  key={`${state.mode}-${state.clientSecret}`}
                  stripe={stripePromise}
                  options={{ clientSecret: state.clientSecret, locale: 'sv', appearance: PTO_APPEARANCE }}
                >
                  <CheckoutForm plan={plan} email={email} returnUrl={returnUrl} />
                </Elements>
              )}

              {/* Friskvårdsbidrag */}
              {state.phase === 'friskvard' && (
                <div className="space-y-4 py-2">
                  <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5 space-y-3">
                    <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Betalning med friskvårdsbidrag
                    </h3>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Din beställning registreras direkt. Du får instruktioner via e-post om hur
                      du slutför betalningen via din arbetsgivares friskvårdsportal.
                    </p>
                    <div className="rounded-xl bg-white/80 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
                      <div className="flex justify-between"><span className="font-medium">Plan:</span><span className="font-bold">{plan.label}</span></div>
                      <div className="flex justify-between"><span className="font-medium">Belopp:</span><span className="font-bold">{plan.price.toLocaleString('sv-SE')} kr</span></div>
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
                    className="co-btn-primary !bg-blue-600 hover:!bg-blue-700"
                  >
                    <Receipt className="w-4 h-4" />
                    Bekräfta friskvårdsbeställning
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('stripe'); setState({ phase: 'selecting' }); }}
                    className="w-full py-2 text-xs text-brand-mutedLight font-bold hover:text-brand-charcoal transition"
                  >
                    ← Byt till kort / Klarna
                  </button>
                </div>
              )}

              {/* Security notice */}
              <p className="text-center text-[10px] text-brand-mutedLight font-medium flex items-center justify-center gap-1.5 mt-5 pt-4 border-t border-brand-line/50">
                <Lock className="w-3 h-3" />
                256-bit krypterad betalning via Stripe
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          TRUST SIGNALS
          ═══════════════════════════════════════ */}
      <section className="py-14 px-5">
        <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Shield, label: 'Krypterad betalning', sub: 'via Stripe' },
            { icon: Clock, label: 'Ingen bindningstid', sub: 'avsluta när du vill' },
            { icon: Users, label: '500+ klienter', sub: 'sedan 2019' },
            { icon: Award, label: 'Friskvårdsgodkänd', sub: 'av Skatteverket' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="co-reveal co-trust-badge">
              <Icon className="w-5 h-5 text-brand-green mx-auto mb-2" />
              <div className="text-[10px] font-black text-brand-charcoal uppercase tracking-wider">{label}</div>
              <div className="text-[9px] text-brand-mutedLight font-medium mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FAQ
          ═══════════════════════════════════════ */}
      <section className="py-20 md:py-24 px-5 bg-white/30">
        <div className="max-w-2xl mx-auto">
          <div className="co-reveal text-center mb-10">
            <p className="co-section-label">Vanliga frågor</p>
            <h2 className="text-xl md:text-2xl font-black text-brand-charcoal">
              Har du funderingar?
            </h2>
          </div>

          <div className="space-y-2">
            {FAQ.map(({ q, a }, i) => (
              <div key={q} className="co-reveal co-faq-item">
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left"
                >
                  <span className="text-sm font-bold text-brand-charcoal pr-4">{q}</span>
                  <ChevronDown className={`w-4 h-4 text-brand-mutedLight flex-shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div className="co-faq-content" data-open={openFaq === i}>
                  <div>
                    <p className="px-5 pb-4 text-xs text-brand-muted font-medium leading-relaxed">{a}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          BOTTOM CTA
          ═══════════════════════════════════════ */}
      <section className="py-20 md:py-24 px-5">
        <div className="max-w-xl mx-auto text-center">
          <div className="co-reveal">
            <Sparkles className="w-6 h-6 text-brand-green mx-auto mb-4" />
            <h2 className="text-xl md:text-2xl font-black text-brand-charcoal mb-3">
              Redo att bli den bästa versionen av dig?
            </h2>
            <p className="text-sm text-brand-muted font-medium mb-7 max-w-sm mx-auto">
              Välj plan, betala enkelt och kom igång direkt. Ditt team väntar på dig.
            </p>
            <button
              type="button"
              onClick={scrollToCheckout}
              className="co-btn-primary co-cta-pulse !w-auto !inline-flex !px-8 !rounded-2xl shadow-lg shadow-brand-green/20"
            >
              Välj plan & kom igång
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer mini */}
      <footer className="py-8 px-5 border-t border-brand-line/40">
        <p className="text-center text-[10px] text-brand-mutedLight font-medium">
          © {new Date().getFullYear()} Private Training Online · Org.nr 559387-3108 ·{' '}
          <a href="https://www.privatetrainingonline.se" className="underline hover:text-brand-charcoal transition">
            privatetrainingonline.se
          </a>
        </p>
      </footer>
    </div>
  );
};

export default Checkout;
