import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import type { Appearance } from '@stripe/stripe-js';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Loader2, AlertTriangle, ArrowRight, ArrowDown,
  Shield, Zap, Award, Lock, Star, Timer,
  Dumbbell, Utensils, BarChart3, Smartphone, MessageCircle,
  Clock, Users, CheckCircle2, Undo2, Home,
  CreditCard, ChevronDown,
} from 'lucide-react';

import { CHECKOUT_PLANS, DEFAULT_PLAN_ID, getPlanById, buildRenewalPlan, getVisiblePlans, TRIAL_PLAN } from '../lib/checkoutPlans';
import type { CheckoutPlan } from '../lib/checkoutPlans';
import { createIntent } from '../utils/checkoutClient';
import { trackCheckoutEvent } from '../utils/paymentAnalytics';
import { useAuthStore } from '../store/authStore';
import { computeYearEndOffer } from '../utils/extensionOffer';

import { CheckoutHeader } from '../components/checkout/CheckoutHeader';
import { PlanSelector } from '../components/checkout/PlanSelector';
import { CheckoutForm } from '../components/checkout/CheckoutForm';
import { PaymentMethodBadges } from '../components/checkout/PaymentMethodBadges';

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
    '.Input': { border: '1px solid #E6E1D8', boxShadow: 'none', padding: '12px 14px' },
    '.Input:focus': { border: '1px solid #a0c81d', boxShadow: '0 0 0 1px #a0c81d' },
    '.Label': { color: '#6B6158', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' as any, letterSpacing: '0.05em' },
    '.Tab': { border: '1px solid #E6E1D8', borderRadius: '12px' },
    '.Tab--selected': { border: '1px solid #a0c81d', backgroundColor: '#f5fae6' },
  },
};

// ── Data ──

const FEATURES = [
  { icon: Dumbbell, title: 'Personlig coach', desc: 'Skräddarsytt träningsprogram anpassat efter dina mål, vardag och förutsättningar.' },
  { icon: Utensils, title: 'AI-drivna veckomenyer', desc: 'Veckomeny med recept, inköpslista och makron — genererad efter dina preferenser.' },
  { icon: BarChart3, title: 'Uppföljning varje månad', desc: 'Regelbunden checkin och ny planering så att du alltid rör dig framåt.' },
  { icon: Smartphone, title: 'Allt i en app', desc: 'Träning, kost och kontakt med ditt team — samlat direkt i mobilen.' },
  { icon: MessageCircle, title: 'Direkt kontakt', desc: 'Chatt med ditt team för snabb hjälp och motivation när du behöver det.' },
  { icon: Clock, title: 'Flexibelt upplägg', desc: 'Välj paket eller månadsvis. Ingen bindningstid — avsluta när du vill.' },
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
  { q: 'Vad ingår?', a: 'Personlig coach, skräddarsytt tränings- och kostschema, AI-drivna veckomenyer, regelbunden uppföljning och ny planering varje månad. Allt samlat i en app.' },
  { q: 'Hur avslutar jag?', a: 'Månadsvis avslutar du när du vill, utan bindningstid. Paket löper ut automatiskt vid periodens slut — inga dolda avgifter.' },
  { q: 'Fungerar det med friskvårdsbidrag?', a: 'Ja! Välj "Friskvårdsbidrag" som betalmetod nedan. Du kan betala hela eller delar via din arbetsgivares friskvårdsportal.' },
  { q: 'När kan jag börja?', a: 'Du väljer själv önskat startdatum och kan börja när du vill. När du slutfört din anmälan så har du kontakt med din nya coach inom 24 timmar.' },
  { q: 'Hur snabbt kommer jag igång?', a: 'Direkt efter betalning. Du får ett välkomstmejl med instruktioner, fyller i startformuläret och ditt team börjar jobba på din plan.' },
];

// ── Campaign config ──

const CAMPAIGN = {
  active: true,
  name: 'Vårkampanj',
  headline: 'Kom igång till kampanjpris',
  deadline: new Date('2026-05-31T23:59:59'),
  badge: 'Erbjudande',
};

// ── Countdown hook ──

function useCountdown(deadline: Date) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = deadline.getTime() - Date.now();
    return diff > 0 ? diff : 0;
  });

  useEffect(() => {
    if (timeLeft <= 0) return;
    const id = setInterval(() => {
      const diff = deadline.getTime() - Date.now();
      setTimeLeft(diff > 0 ? diff : 0);
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, timeLeft > 0]);

  const days = Math.floor(timeLeft / 86_400_000);
  const hours = Math.floor((timeLeft % 86_400_000) / 3_600_000);
  const mins = Math.floor((timeLeft % 3_600_000) / 60_000);
  const secs = Math.floor((timeLeft % 60_000) / 1000);
  const expired = timeLeft <= 0;

  return { days, hours, mins, secs, expired };
}

// ── Checkout state ──

type CheckoutState =
  | { phase: 'selecting' }
  | { phase: 'loading' }
  | { phase: 'ready'; clientSecret: string; publishableKey: string; mode: 'payment' | 'subscription' }
  | { phase: 'error'; message: string }
  | { phase: 'friskvard' };

// ── Page ──

export const BliKlient: React.FC = () => {
  const { session, profile } = useAuthStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Checkout state
  const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_PLAN_ID);
  const [state, setState] = useState<CheckoutState>({ phase: 'selecting' });
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'friskvard'>('stripe');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const checkoutRef = useRef<HTMLDivElement>(null);

  // ── Renewal mode ──
  const isRenewalFlow = searchParams.get('flow') === 'renewal';
  const isActiveMember = Boolean(
    profile && (profile.membership_type === 'package' || profile.membership_type === 'subscription' || profile.membership_type === 'hybrid'),
  );

  const renewalOffer = useMemo(() => {
    if (!isActiveMember || !profile?.coaching_expires_at) return null;
    return computeYearEndOffer({ coachingExpiresAt: profile.coaching_expires_at, monthlyPrice: 249 });
  }, [isActiveMember, profile?.coaching_expires_at]);

  const renewalPlan = useMemo(() => {
    if (!renewalOffer) return null;
    return buildRenewalPlan(renewalOffer);
  }, [renewalOffer]);

  // Trial toggle
  const showTrialPlan = !renewalOffer && import.meta.env.VITE_TRIAL_ENABLED === 'true';

  const showTestPlan = searchParams.get('test') === '1';
  const availablePlans = useMemo(() => {
    const base = getVisiblePlans(showTestPlan);
    if (renewalPlan) return [renewalPlan, ...base];
    if (showTrialPlan) return [TRIAL_PLAN, ...base];
    return base;
  }, [renewalPlan, showTestPlan, showTrialPlan]);

  // Auto-select
  useEffect(() => {
    if (isRenewalFlow && renewalPlan && selectedPlanId !== 'renewal') {
      setSelectedPlanId('renewal');
      setState({ phase: 'selecting' });
    }
  }, [isRenewalFlow, renewalPlan]);

  useEffect(() => {
    if (showTrialPlan && selectedPlanId !== 'trial30' && !isRenewalFlow) {
      setSelectedPlanId('trial30');
      setPaymentMethod('stripe');
    }
  }, [showTrialPlan, isRenewalFlow]);

  const plan = useMemo(() => {
    if (selectedPlanId === 'renewal' && renewalPlan) return renewalPlan;
    return getPlanById(selectedPlanId) || getVisiblePlans(showTestPlan)[0];
  }, [selectedPlanId, renewalPlan]);

  useEffect(() => {
    if (session?.user?.email && !email) setEmail(session.user.email);
    if (profile?.full_name && !fullName) setFullName(profile.full_name);
  }, [session, profile]);

  // GA4 events
  useEffect(() => {
    pushEvent('page_view', { page_title: 'Bli klient', page_location: window.location.href, page_path: '/bli-klient' });
  }, []);

  const beginCheckoutFired = useRef(false);
  useEffect(() => {
    if (beginCheckoutFired.current && !isRenewalFlow) return;
    beginCheckoutFired.current = true;
    trackCheckoutEvent('checkout_started', { flow: 'bli-klient', mode: plan.mode });
    if (typeof window !== 'undefined') {
      const purchaseType = (plan.isRenewal || isActiveMember) ? 'renewal' : 'new_purchase';
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({
        event: 'begin_checkout',
        ecommerce: {
          currency: 'SEK', value: plan.price,
          items: [{ item_id: selectedPlanId, item_name: plan.label, item_category: purchaseType, price: plan.price, currency: 'SEK', quantity: 1 }],
        },
      });
    }
  }, [selectedPlanId]);

  // Scroll to checkout
  const scrollToCheckout = useCallback(() => {
    checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    pushEvent('cta_click', { page: 'bli-klient', label: 'scroll_to_checkout' });
  }, []);

  // Plan selection
  const handlePlanSelect = useCallback((planId: string) => {
    setSelectedPlanId(planId);
    setState({ phase: 'selecting' });
    const selected = availablePlans.find((p) => p.id === planId) || getPlanById(planId);
    if (selected?.isTrial && paymentMethod !== 'stripe') setPaymentMethod('stripe');
  }, [availablePlans]);

  // Start payment
  const handleStartPayment = useCallback(async () => {
    if (!email.trim()) {
      setState({ phase: 'error', message: 'Ange din e-postadress.' });
      return;
    }

    const purchaseType = (plan.isRenewal || isActiveMember) ? 'renewal' : 'new_purchase';

    // GA4
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({
        event: 'add_payment_info',
        ecommerce: {
          currency: 'SEK', value: plan.price, payment_type: paymentMethod === 'friskvard' ? 'friskvardsbidrag' : 'card_klarna',
          items: [{ item_id: selectedPlanId, item_name: plan.label, item_category: purchaseType, price: plan.price, currency: 'SEK', quantity: 1 }],
        },
      });
      try {
        sessionStorage.setItem('pto_checkout_plan', JSON.stringify({
          id: selectedPlanId, label: plan.label, price: plan.price, currency: 'SEK',
          purchaseType, email: email.trim(), fullName: fullName.trim(),
          monthCount: plan.monthCount || 0, newExpiresAt: plan.renewalOffer?.newExpiresAt || '',
          isTrial: plan.isTrial || false,
        }));
      } catch { /* noop */ }
    }

    if (paymentMethod === 'friskvard') {
      setState({ phase: 'friskvard' });
      return;
    }

    setState({ phase: 'loading' });

    // Renewal
    if (plan.isRenewal && plan.renewalOffer) {
      try {
        const response = await createIntent({
          planId: 'renewal', email: email.trim(), fullName: fullName.trim() || undefined,
          userId: session?.user?.id, renewalOffer: {
            monthlyPrice: plan.renewalOffer.monthlyPrice, monthCount: plan.renewalOffer.monthCount,
            totalPrice: plan.renewalOffer.totalPrice, campaignYear: plan.renewalOffer.campaignYear,
            billableDays: plan.renewalOffer.billableDays, calculationMode: plan.renewalOffer.calculationMode,
            currentExpiresAt: plan.renewalOffer.currentExpiresAt, billingStartsAt: plan.renewalOffer.billingStartsAt,
            newExpiresAt: plan.renewalOffer.newExpiresAt,
          },
        }, session?.access_token);
        if (!response.ok || !response.clientSecret) {
          setState({ phase: 'error', message: response.error || 'Kunde inte starta betalning.' });
          return;
        }
        setState({ phase: 'ready', clientSecret: response.clientSecret, publishableKey: response.publishableKey!, mode: 'payment' });
      } catch { setState({ phase: 'error', message: 'Oväntat fel. Försök igen.' }); }
      return;
    }

    // Standard
    const response = await createIntent({
      planId: selectedPlanId, email: email.trim(), fullName: fullName.trim() || undefined, userId: session?.user?.id,
    }, session?.access_token);
    if (!response.ok || !response.clientSecret) {
      setState({ phase: 'error', message: response.error || 'Kunde inte starta betalning. Försök igen.' });
      return;
    }
    setState({ phase: 'ready', clientSecret: response.clientSecret, publishableKey: response.publishableKey!, mode: response.mode || plan.mode });
  }, [email, fullName, selectedPlanId, paymentMethod, plan, session]);

  const stripePromise = useMemo(() => {
    if (state.phase !== 'ready') return null;
    return loadStripe(state.publishableKey);
  }, [state]);

  const returnUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? `${window.location.origin}/checkout/tack` : 'https://my.privatetrainingonline.se/checkout/tack';
    const purchaseType = (plan.isRenewal || isActiveMember) ? 'renewal' : 'new_purchase';
    const params = new URLSearchParams({
      plan_id: plan.id, plan_label: plan.label, plan_price: String(plan.price), purchase_type: purchaseType,
      month_count: String(plan.monthCount || 0),
      ...(plan.renewalOffer?.newExpiresAt ? { new_expires_at: plan.renewalOffer.newExpiresAt } : {}),
    });
    return `${base}?${params.toString()}`;
  }, [plan]);

  const handleFaqToggle = useCallback((i: number) => {
    setOpenFaq((prev) => {
      const next = prev === i ? null : i;
      if (next !== null) pushEvent('faq_click', { question: FAQ[i].q });
      return next;
    });
  }, []);

  const countdown = useCountdown(CAMPAIGN.deadline);
  const showCampaign = CAMPAIGN.active && !countdown.expired;

  return (
    <div className="min-h-screen bg-[#F6F1E7]">
      <CheckoutHeader />

      {/* ═══ CAMPAIGN BANNER ═══ */}
      {showCampaign && (
        <div className="bg-[#3D3D3D] text-white py-2.5 px-4 mt-[56px]">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-[#a0c81d] text-white text-[9px] font-black uppercase tracking-wider">
                {CAMPAIGN.badge}
              </span>
              <span className="text-xs sm:text-sm font-bold">{CAMPAIGN.headline}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-[#a0c81d]" />
              <div className="flex items-center gap-1 font-mono text-xs sm:text-sm font-bold">
                <span className="bg-white/10 rounded px-1.5 py-0.5">{String(countdown.days).padStart(2, '0')}</span>
                <span className="text-white/40">:</span>
                <span className="bg-white/10 rounded px-1.5 py-0.5">{String(countdown.hours).padStart(2, '0')}</span>
                <span className="text-white/40">:</span>
                <span className="bg-white/10 rounded px-1.5 py-0.5">{String(countdown.mins).padStart(2, '0')}</span>
                <span className="text-white/40">:</span>
                <span className="bg-white/10 rounded px-1.5 py-0.5">{String(countdown.secs).padStart(2, '0')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ HERO ═══ */}
      <section className={`${showCampaign ? 'pt-12 md:pt-20' : 'pt-24 md:pt-32'} pb-16 md:pb-24 px-4 relative overflow-hidden`}>
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
              <div key={text} className="flex items-center gap-3 rounded-2xl bg-white border border-[#E6E1D8] px-4 py-3.5">
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
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#a0c81d] mb-2">Det här ingår</h2>
            <p className="text-xl md:text-2xl font-black text-[#3D3D3D]">Allt du behöver. Inget du inte behöver.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl bg-white border border-[#E6E1D8] p-5 hover:border-[#a0c81d]/40 hover:shadow-lg hover:shadow-[#a0c81d]/[0.06] transition-all duration-300 group">
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
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#a0c81d] mb-2">Så fungerar det</h2>
            <p className="text-xl md:text-2xl font-black text-[#3D3D3D]">Tre steg. Sedan kör vi.</p>
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

      {/* ═══ CHECKOUT (inline) ═══ */}
      <section ref={checkoutRef} className="py-16 md:py-20 px-4 scroll-mt-20" id="checkout">
        <div className="max-w-[800px] mx-auto">
          {/* Section header */}
          <div className="text-center mb-8">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#a0c81d] mb-2">Steg 1 av 3</h2>
            <p className="text-xl md:text-2xl font-black text-[#3D3D3D]">Välj plan & kom igång</p>
            <p className="text-sm text-[#6B6158] font-medium mt-2 max-w-lg mx-auto">
              Som ny klient guidas du steg för steg genom hela processen. Din nya coach kontaktar dig inom 24 timmar.
            </p>
          </div>

          {/* Checkout card */}
          <div className="rounded-3xl bg-white border border-[#E6E1D8] shadow-xl shadow-black/[0.04] p-6 md:p-8">

            {/* Email & name */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-1.5">E-post</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="din@email.se"
                  className="w-full px-4 py-3 rounded-xl border border-[#E6E1D8] bg-white text-sm text-[#3D3D3D] placeholder:text-[#C5BFB5] focus:outline-none focus:ring-2 focus:ring-[#a0c81d] focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-1.5">
                  Namn <span className="text-[#C5BFB5]">(valfritt)</span>
                </label>
                <input
                  type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ditt namn"
                  className="w-full px-4 py-3 rounded-xl border border-[#E6E1D8] bg-white text-sm text-[#3D3D3D] placeholder:text-[#C5BFB5] focus:outline-none focus:ring-2 focus:ring-[#a0c81d] focus:border-transparent transition"
                />
              </div>
            </div>

            <div className="border-t border-[#E6E1D8] my-6" />

            {/* Plan selection */}
            <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-3">Välj plan</p>
            <PlanSelector
              plans={paymentMethod === 'friskvard' ? availablePlans.filter(p => p.id !== 'monthly') : availablePlans}
              selectedPlanId={selectedPlanId}
              onSelect={handlePlanSelect}
            />

            <div className="border-t border-[#E6E1D8] my-6" />

            {/* Payment method */}
            <div className="space-y-2 mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Betalningsmetod</p>
              <div className="rounded-xl border border-[#E6E1D8] overflow-hidden">
                {plan.isTrial ? (
                  <button
                    type="button"
                    onClick={() => { setPaymentMethod('stripe'); setState({ phase: 'selecting' }); }}
                    className="w-full flex items-center gap-3 px-4 py-3 transition-all text-left bg-[#FAFAF5]"
                  >
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-[#a0c81d] flex items-center justify-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#a0c81d]" />
                    </div>
                    <CreditCard className="w-4 h-4 flex-shrink-0 text-[#6B8A12]" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold block text-[#3D3D3D]">Prova gratis</span>
                      <span className="text-[10px] text-[#8A8177] font-medium">Prova gratis i 30 dagar – därefter 549 kr/mån. Inga bindnings- eller uppsägningstider.</span>
                    </div>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { setPaymentMethod('stripe'); setState({ phase: 'selecting' }); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left ${paymentMethod === 'stripe' ? 'bg-[#FAFAF5]' : 'bg-white hover:bg-[#FAFAF5]'}`}
                    >
                      <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${paymentMethod === 'stripe' ? 'border-[#a0c81d]' : 'border-[#C5BFB5]'}`}>
                        {paymentMethod === 'stripe' && <div className="w-2.5 h-2.5 rounded-full bg-[#a0c81d]" />}
                      </div>
                      <CreditCard className={`w-4 h-4 flex-shrink-0 ${paymentMethod === 'stripe' ? 'text-[#6B8A12]' : 'text-[#8A8177]'}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold block ${paymentMethod === 'stripe' ? 'text-[#3D3D3D]' : 'text-[#6B6158]'}`}>Kort / Klarna</span>
                        <span className="text-[10px] text-[#8A8177] font-medium">Betala direkt med kort, Apple Pay eller Klarna</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('friskvard');
                        setState({ phase: 'selecting' });
                        if (selectedPlanId === 'monthly') setSelectedPlanId('12m');
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 border-t border-[#E6E1D8] transition-all text-left ${paymentMethod === 'friskvard' ? 'bg-[#FAFAF5]' : 'bg-white hover:bg-[#FAFAF5]'}`}
                    >
                      <div className={`w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${paymentMethod === 'friskvard' ? 'border-[#a0c81d]' : 'border-[#C5BFB5]'}`}>
                        {paymentMethod === 'friskvard' && <div className="w-2.5 h-2.5 rounded-full bg-[#a0c81d]" />}
                      </div>
                      <Dumbbell className={`w-4 h-4 flex-shrink-0 ${paymentMethod === 'friskvard' ? 'text-[#6B8A12]' : 'text-[#8A8177]'}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-semibold block ${paymentMethod === 'friskvard' ? 'text-[#3D3D3D]' : 'text-[#6B6158]'}`}>Friskvårdsbidrag</span>
                        <span className="text-[10px] text-[#8A8177] font-medium">Betala via din arbetsgivares friskvårdsbidrag</span>
                      </div>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Error + CTA */}
            {(state.phase === 'selecting' || state.phase === 'error') && (
              <div className="space-y-4 mb-4">
                {state.phase === 'error' && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{state.message}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleStartPayment}
                  className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-[#a0c81d] text-white hover:bg-[#8ab516] hover:shadow-lg hover:shadow-[#a0c81d]/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                >
                  Fortsätt
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Loading */}
            {state.phase === 'loading' && (
              <div className="flex items-center justify-center py-16">
                <div className="text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-[#a0c81d] mx-auto" />
                  <p className="text-sm text-[#6B6158] font-medium">Förbereder betalning...</p>
                </div>
              </div>
            )}

            {/* Stripe Payment Element */}
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
                  <h3 className="text-sm font-bold text-blue-900">Betalning med friskvårdsbidrag</h3>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Din beställning registreras direkt. Du får instruktioner via e-post om hur du slutför betalningen via din arbetsgivares friskvårdsportal.
                  </p>
                  <div className="rounded-xl bg-white/80 border border-blue-200 p-3 space-y-1 text-xs text-blue-800">
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
                          flow: plan.id === 'renewal' ? 'forlangning' : 'premium',
                          mode: plan.id === 'renewal' ? 'payment' : plan.mode,
                          paymentMethod: 'friskvardsbidrag',
                          email, fullName, userId: session?.user?.id,
                          planId: plan.id, planLabel: plan.label, planPrice: plan.price,
                          planMonthCount: plan.monthCount || 0,
                          ...(plan.id === 'renewal' && renewalOffer ? {
                            forlangningOffer: {
                              monthlyPrice: renewalOffer.monthlyPrice, monthCount: renewalOffer.monthCount,
                              totalPrice: renewalOffer.totalPrice, campaignYear: renewalOffer.campaignYear,
                              billableDays: renewalOffer.billableDays, calculationMode: renewalOffer.calculationMode,
                              currentExpiresAt: renewalOffer.currentExpiresAt, billingStartsAt: renewalOffer.billingStartsAt,
                              newExpiresAt: renewalOffer.newExpiresAt,
                            },
                          } : {}),
                        }),
                      });
                      const data = await response.json();
                      if (data.ok && data.friskvard) {
                        const purchaseType = (plan.isRenewal || isActiveMember) ? 'renewal' : 'new_purchase';
                        if (typeof window !== 'undefined') {
                          window.dataLayer = window.dataLayer || [];
                          window.dataLayer.push({ ecommerce: null });
                          window.dataLayer.push({
                            event: 'purchase',
                            ecommerce: {
                              transaction_id: `friskvard_${data.friskvard_order_id || Date.now()}`,
                              currency: 'SEK', value: plan.price, payment_type: 'friskvardsbidrag',
                              items: [{ item_id: plan.id, item_name: plan.label, item_category: purchaseType, price: plan.price, currency: 'SEK', quantity: 1 }],
                            },
                          });
                          window.dataLayer.push({
                            event: purchaseType === 'renewal' ? 'pto_renewal_completed' : 'pto_new_purchase_completed',
                            purchaseType, paymentMethod: 'friskvardsbidrag', planId: plan.id, value: plan.price,
                          });
                        }
                        const params = new URLSearchParams({ friskvard: '1', plan: plan.label, price: String(plan.price) });
                        navigate(`/tack-forlangning-friskvard?${params.toString()}`);
                      } else {
                        setState({ phase: 'error', message: data.error || 'Kunde inte registrera friskvårdsbeställning.' });
                      }
                    } catch { setState({ phase: 'error', message: 'Oväntat fel. Försök igen.' }); }
                  }}
                  className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
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

            {/* Security */}
            <p className="text-center text-[10px] text-[#8A8177] font-medium flex items-center justify-center gap-1 mt-4">
              <Lock className="w-3 h-3" /> Säker betalning
            </p>
            <div className="mt-3">
              <PaymentMethodBadges />
            </div>
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
              <div key={label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white border border-[#E6E1D8] p-4 text-center">
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
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#a0c81d] mb-2">Vanliga frågor</h2>
            <p className="text-xl md:text-2xl font-black text-[#3D3D3D]">Har du en fråga?</p>
          </div>
          <div className="space-y-2">
            {FAQ.map(({ q, a }, i) => (
              <div key={q} className="rounded-2xl border border-[#E6E1D8] bg-white overflow-hidden">
                <button type="button" onClick={() => handleFaqToggle(i)} className="w-full flex items-center justify-between px-5 py-4 text-left">
                  <span className="text-sm font-bold text-[#3D3D3D] pr-4">{q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#8A8177] flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${openFaq === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="px-5 pb-4 text-xs text-[#6B6158] font-medium leading-relaxed">{a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 bg-[#3D3D3D] text-center">
        <p className="text-[10px] text-white/50 font-medium">
          © {new Date().getFullYear()} Private Training Online · Org.nr 559387-3108 ·{' '}
          <a href="https://www.privatetrainingonline.se" className="underline hover:text-white/80 transition">
            privatetrainingonline.se
          </a>
        </p>
      </footer>
    </div>
  );
};

export default BliKlient;
