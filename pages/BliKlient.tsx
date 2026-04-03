import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import type { Appearance } from '@stripe/stripe-js';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Loader2, AlertTriangle, ArrowRight,
  Shield, Zap, Lock, Timer,
  Dumbbell, Users, CheckCircle, Undo2, Award,
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

// ── GTM ──

declare global {
  interface Window { dataLayer?: Record<string, unknown>[]; }
}
function pushEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
  }
}

// ── Stripe ──

const PTO_APPEARANCE: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#a0c81d', colorBackground: '#ffffff', colorText: '#3D3D3D',
    colorDanger: '#df1b41', fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '12px', spacingUnit: '4px',
  },
  rules: {
    '.Input': { border: '1px solid #E6E1D8', boxShadow: 'none', padding: '12px 14px' },
    '.Input:focus': { border: '1px solid #a0c81d', boxShadow: '0 0 0 1px #a0c81d' },
    '.Label': { color: '#6B6158', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' as any, letterSpacing: '0.05em' },
    '.Tab': { border: '1px solid #E6E1D8', borderRadius: '12px' },
    '.Tab--selected': { border: '1px solid #a0c81d', backgroundColor: '#f5fae6' },
  },
};

// ── Campaign ──

const CAMPAIGN = {
  active: true,
  name: 'Vårkampanj',
  tagline: 'Kom igång till kampanjpris',
  deadline: new Date('2026-05-31T23:59:59'),
};

function useCountdown(deadline: Date) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, deadline.getTime() - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    mins: Math.floor((diff % 3_600_000) / 60_000),
    secs: Math.floor((diff % 60_000) / 1000),
    expired: diff <= 0,
  };
}

// ── Data ──

const TRUST_BULLETS = [
  { icon: Users,      text: 'Över 30 000 nöjda klienter sedan 2012.' },
  { icon: CheckCircle, text: 'Priset gäller för hela perioden.' },
  { icon: Zap,        text: 'Inga månadsavgifter eller bindningstider.' },
  { icon: Dumbbell,   text: 'Träna hemma, utomhus eller på gym.' },
  { icon: Undo2,      text: '14 dagars ångerrätt.' },
  { icon: Award,      text: 'Godkänt för friskvårdsbidrag.' },
];

const FAQ = [
  { q: 'Vad ingår?', a: 'Personlig coach, skräddarsytt tränings- och kostschema, AI-drivna veckomenyer, regelbunden uppföljning och ny planering varje månad. Allt samlat i en app.' },
  { q: 'Hur avslutar jag?', a: 'Månadsvis avslutar du när du vill, utan bindningstid. Paket löper ut automatiskt vid periodens slut — inga dolda avgifter.' },
  { q: 'Fungerar det med friskvårdsbidrag?', a: 'Ja! Välj "Friskvårdsbidrag" som betalmetod. Du kan betala hela eller delar via din arbetsgivares friskvårdsportal.' },
  { q: 'När kan jag börja?', a: 'Du väljer själv önskat startdatum. När du slutfört din anmälan så har du kontakt med din nya coach inom 24 timmar.' },
  { q: 'Hur snabbt kommer jag igång?', a: 'Direkt efter betalning. Du får ett välkomstmejl med instruktioner, fyller i startformuläret och ditt team börjar jobba på din plan.' },
];

// ── Checkout state ──

type CheckoutState =
  | { phase: 'selecting' }
  | { phase: 'loading' }
  | { phase: 'ready'; clientSecret: string; publishableKey: string; mode: 'payment' | 'subscription' }
  | { phase: 'error'; message: string }
  | { phase: 'friskvard' };

// ══════════════════════════════════════════════════
//  PAGE
// ══════════════════════════════════════════════════

export const BliKlient: React.FC = () => {
  const { session, profile } = useAuthStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [selectedPlanId, setSelectedPlanId] = useState(DEFAULT_PLAN_ID);
  const [state, setState] = useState<CheckoutState>({ phase: 'selecting' });
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'friskvard'>('stripe');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const checkoutRef = useRef<HTMLDivElement>(null);
  const countdown = useCountdown(CAMPAIGN.deadline);
  const showCampaign = CAMPAIGN.active && !countdown.expired;

  // ── Renewal / Trial ──
  const isRenewalFlow = searchParams.get('flow') === 'renewal';
  const isActiveMember = Boolean(profile && (profile.membership_type === 'package' || profile.membership_type === 'subscription' || profile.membership_type === 'hybrid'));

  const renewalOffer = useMemo(() => {
    if (!isActiveMember || !profile?.coaching_expires_at) return null;
    return computeYearEndOffer({ coachingExpiresAt: profile.coaching_expires_at, monthlyPrice: 249 });
  }, [isActiveMember, profile?.coaching_expires_at]);

  const renewalPlan = useMemo(() => renewalOffer ? buildRenewalPlan(renewalOffer) : null, [renewalOffer]);

  const showTrialPlan = !renewalOffer && import.meta.env.VITE_TRIAL_ENABLED === 'true';
  const showTestPlan = searchParams.get('test') === '1';

  const availablePlans = useMemo(() => {
    const base = getVisiblePlans(showTestPlan);
    if (renewalPlan) return [renewalPlan, ...base];
    if (showTrialPlan) return [TRIAL_PLAN, ...base];
    return base;
  }, [renewalPlan, showTestPlan, showTrialPlan]);

  useEffect(() => {
    if (isRenewalFlow && renewalPlan && selectedPlanId !== 'renewal') { setSelectedPlanId('renewal'); setState({ phase: 'selecting' }); }
  }, [isRenewalFlow, renewalPlan]);

  useEffect(() => {
    if (showTrialPlan && selectedPlanId !== 'trial30' && !isRenewalFlow) { setSelectedPlanId('trial30'); setPaymentMethod('stripe'); }
  }, [showTrialPlan, isRenewalFlow]);

  const plan = useMemo(() => {
    if (selectedPlanId === 'renewal' && renewalPlan) return renewalPlan;
    return getPlanById(selectedPlanId) || getVisiblePlans(showTestPlan)[0];
  }, [selectedPlanId, renewalPlan]);

  useEffect(() => {
    if (session?.user?.email && !email) setEmail(session.user.email);
    if (profile?.full_name && !fullName) setFullName(profile.full_name);
  }, [session, profile]);

  // GA4
  useEffect(() => {
    pushEvent('page_view', { page_title: 'Bli klient', page_location: window.location.href, page_path: '/bli-klient' });
  }, []);

  const beginCheckoutFired = useRef(false);
  useEffect(() => {
    if (beginCheckoutFired.current && !isRenewalFlow) return;
    beginCheckoutFired.current = true;
    trackCheckoutEvent('checkout_started', { flow: 'bli-klient', mode: plan.mode });
    const purchaseType = (plan.isRenewal || isActiveMember) ? 'renewal' : 'new_purchase';
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ event: 'begin_checkout', ecommerce: { currency: 'SEK', value: plan.price, items: [{ item_id: selectedPlanId, item_name: plan.label, item_category: purchaseType, price: plan.price, currency: 'SEK', quantity: 1 }] } });
  }, [selectedPlanId]);

  // ── Handlers ──

  const handlePlanSelect = useCallback((planId: string) => {
    setSelectedPlanId(planId);
    setState({ phase: 'selecting' });
    const selected = availablePlans.find(p => p.id === planId) || getPlanById(planId);
    if (selected?.isTrial && paymentMethod !== 'stripe') setPaymentMethod('stripe');
  }, [availablePlans]);

  const handleStartPayment = useCallback(async () => {
    if (!email.trim()) { setState({ phase: 'error', message: 'Ange din e-postadress.' }); return; }

    const purchaseType = (plan.isRenewal || isActiveMember) ? 'renewal' : 'new_purchase';
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ecommerce: null });
    window.dataLayer.push({ event: 'add_payment_info', ecommerce: { currency: 'SEK', value: plan.price, payment_type: paymentMethod === 'friskvard' ? 'friskvardsbidrag' : 'card_klarna', items: [{ item_id: selectedPlanId, item_name: plan.label, item_category: purchaseType, price: plan.price, currency: 'SEK', quantity: 1 }] } });
    try { sessionStorage.setItem('pto_checkout_plan', JSON.stringify({ id: selectedPlanId, label: plan.label, price: plan.price, currency: 'SEK', purchaseType, email: email.trim(), fullName: fullName.trim(), monthCount: plan.monthCount || 0, newExpiresAt: plan.renewalOffer?.newExpiresAt || '', isTrial: plan.isTrial || false })); } catch { /* noop */ }

    if (paymentMethod === 'friskvard') { setState({ phase: 'friskvard' }); return; }
    setState({ phase: 'loading' });

    if (plan.isRenewal && plan.renewalOffer) {
      try {
        const r = await createIntent({ planId: 'renewal', email: email.trim(), fullName: fullName.trim() || undefined, userId: session?.user?.id, renewalOffer: { monthlyPrice: plan.renewalOffer.monthlyPrice, monthCount: plan.renewalOffer.monthCount, totalPrice: plan.renewalOffer.totalPrice, campaignYear: plan.renewalOffer.campaignYear, billableDays: plan.renewalOffer.billableDays, calculationMode: plan.renewalOffer.calculationMode, currentExpiresAt: plan.renewalOffer.currentExpiresAt, billingStartsAt: plan.renewalOffer.billingStartsAt, newExpiresAt: plan.renewalOffer.newExpiresAt } }, session?.access_token);
        if (!r.ok || !r.clientSecret) { setState({ phase: 'error', message: r.error || 'Kunde inte starta betalning.' }); return; }
        setState({ phase: 'ready', clientSecret: r.clientSecret, publishableKey: r.publishableKey!, mode: 'payment' });
      } catch { setState({ phase: 'error', message: 'Oväntat fel. Försök igen.' }); }
      return;
    }

    const r = await createIntent({ planId: selectedPlanId, email: email.trim(), fullName: fullName.trim() || undefined, userId: session?.user?.id }, session?.access_token);
    if (!r.ok || !r.clientSecret) { setState({ phase: 'error', message: r.error || 'Kunde inte starta betalning. Försök igen.' }); return; }
    setState({ phase: 'ready', clientSecret: r.clientSecret, publishableKey: r.publishableKey!, mode: r.mode || plan.mode });
  }, [email, fullName, selectedPlanId, paymentMethod, plan, session]);

  const stripePromise = useMemo(() => state.phase === 'ready' ? loadStripe(state.publishableKey) : null, [state]);

  const returnUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? `${window.location.origin}/checkout/tack` : 'https://my.privatetrainingonline.se/checkout/tack';
    const purchaseType = (plan.isRenewal || isActiveMember) ? 'renewal' : 'new_purchase';
    const params = new URLSearchParams({ plan_id: plan.id, plan_label: plan.label, plan_price: String(plan.price), purchase_type: purchaseType, month_count: String(plan.monthCount || 0), ...(plan.renewalOffer?.newExpiresAt ? { new_expires_at: plan.renewalOffer.newExpiresAt } : {}) });
    return `${base}?${params.toString()}`;
  }, [plan]);

  // ══════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #F6F1E7 0%, #EDE8DB 40%, #E8E3D6 100%)' }}>
      <CheckoutHeader />

      {/* ═══ CAMPAIGN TICKER ═══ */}
      {showCampaign && (
        <div className="bg-[#2C2C2C] py-2 px-4 mt-[56px] overflow-hidden">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-3 sm:gap-5">
            <span className="shrink-0 px-2 py-0.5 rounded bg-[#a0c81d] text-[9px] font-black text-white uppercase tracking-widest">
              {CAMPAIGN.name}
            </span>
            <span className="text-white/80 text-xs font-semibold hidden sm:block">{CAMPAIGN.tagline}</span>
            <div className="flex items-center gap-1 font-mono text-white text-[11px] font-bold tracking-tight">
              <Timer className="w-3 h-3 text-[#a0c81d] mr-0.5" aria-hidden="true" />
              <span className="bg-white/[0.08] rounded px-1.5 py-0.5">{String(countdown.days).padStart(2,'0')}</span>
              <span className="text-white/30">:</span>
              <span className="bg-white/[0.08] rounded px-1.5 py-0.5">{String(countdown.hours).padStart(2,'0')}</span>
              <span className="text-white/30">:</span>
              <span className="bg-white/[0.08] rounded px-1.5 py-0.5">{String(countdown.mins).padStart(2,'0')}</span>
              <span className="text-white/30">:</span>
              <span className="bg-white/[0.08] rounded px-1.5 py-0.5">{String(countdown.secs).padStart(2,'0')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAIN CONTENT — Two-column on desktop ═══ */}
      <div className={`max-w-[1080px] mx-auto px-4 ${showCampaign ? 'pt-8 md:pt-12' : 'pt-20 md:pt-28'} pb-10`}>
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">

          {/* ─── LEFT: Campaign hero + trust bullets ─── */}
          <div className="w-full lg:w-[420px] lg:sticky lg:top-24 shrink-0">
            {/* Campaign heading */}
            <h1 className="text-2xl sm:text-3xl font-black text-[#3D3D3D] leading-tight tracking-tight mb-3" style={{ fontFamily: "'Inter', system-ui, sans-serif", textWrap: 'balance' as any }}>
              {showCampaign ? CAMPAIGN.name : 'Bli klient'}
            </h1>

            {showCampaign && (
              <p className="text-sm text-[#6B6158] leading-relaxed mb-4">
                Registrera dig innan kampanjen löper ut och kom igång till kampanjpris.
              </p>
            )}

            <p className="text-sm text-[#3D3D3D] font-medium leading-relaxed mb-6">
              Du väljer själv önskat startdatum och kan börja när du vill. När du slutfört din anmälan
              så har du kontakt med din nya coach inom 24 timmar.
            </p>

            {/* Trust bullets */}
            <ul className="space-y-2.5 mb-8">
              {TRUST_BULLETS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5">
                  <Icon className="w-4 h-4 text-[#a0c81d] mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="text-[13px] text-[#4A4A4A] font-medium leading-snug">{text}</span>
                </li>
              ))}
            </ul>

            {/* Security strip — desktop only */}
            <div className="hidden lg:flex items-center gap-4 text-[10px] text-[#8A8177] font-bold uppercase tracking-wider pb-4">
              <span className="flex items-center gap-1"><Lock className="w-3 h-3" aria-hidden="true" /> Säker betalning</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Shield className="w-3 h-3" aria-hidden="true" /> Krypterat via Stripe</span>
            </div>
          </div>

          {/* ─── RIGHT: Checkout form ─── */}
          <div ref={checkoutRef} className="flex-1 w-full min-w-0">
            <div className="rounded-2xl bg-white border border-[#DDD8CD] shadow-lg shadow-black/[0.04] overflow-hidden">

              {/* Card header */}
              <div className="bg-[#FAFAF5] border-b border-[#E6E1D8] px-5 py-3.5">
                <h2 className="text-[11px] font-black text-[#6B6158] uppercase tracking-[0.15em]">Anmälan</h2>
              </div>

              <div className="p-5 md:p-6 space-y-5">
                {/* E-post */}
                <div>
                  <label htmlFor="bk-email" className="block text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-1.5">E-post <span className="text-red-400">*</span></label>
                  <input id="bk-email" name="email" type="email" autoComplete="email" spellCheck={false} value={email} onChange={e => setEmail(e.target.value)} placeholder="namn@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-[#E6E1D8] bg-white text-sm text-[#3D3D3D] placeholder:text-[#C5BFB5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a0c81d]/60 focus-visible:border-transparent transition-colors" />
                </div>

                {/* Name */}
                <div>
                  <label htmlFor="bk-name" className="block text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-1.5">
                    Namn <span className="text-[#C5BFB5] normal-case tracking-normal font-medium">(valfritt)</span>
                  </label>
                  <input id="bk-name" name="name" type="text" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Förnamn Efternamn"
                    className="w-full px-4 py-3 rounded-xl border border-[#E6E1D8] bg-white text-sm text-[#3D3D3D] placeholder:text-[#C5BFB5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a0c81d]/60 focus-visible:border-transparent transition-colors" />
                </div>

                <div className="border-t border-[#E6E1D8]" />

                {/* Plan */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2.5">Paket</label>
                  <PlanSelector
                    plans={paymentMethod === 'friskvard' ? availablePlans.filter(p => p.id !== 'monthly') : availablePlans}
                    selectedPlanId={selectedPlanId}
                    onSelect={handlePlanSelect}
                  />
                </div>

                <div className="border-t border-[#E6E1D8]" />

                {/* Payment method */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Betalningsmetod</label>
                  <div className="rounded-xl border border-[#E6E1D8] overflow-hidden">
                    {plan.isTrial ? (
                      <div className="flex items-center gap-3 px-4 py-3 bg-[#FAFAF5]">
                        <div className="w-4 h-4 rounded-full border-2 border-[#a0c81d] flex items-center justify-center shrink-0">
                          <div className="w-2 h-2 rounded-full bg-[#a0c81d]" />
                        </div>
                        <CreditCard className="w-4 h-4 text-[#6B8A12] shrink-0" aria-hidden="true" />
                        <div>
                          <span className="text-sm font-semibold text-[#3D3D3D] block">Prova gratis</span>
                          <span className="text-[10px] text-[#8A8177]">30 dagar gratis – därefter 549 kr/mån</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button type="button" onClick={() => { setPaymentMethod('stripe'); setState({ phase: 'selecting' }); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${paymentMethod === 'stripe' ? 'bg-[#FAFAF5]' : 'bg-white hover:bg-[#FAFAF5]'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === 'stripe' ? 'border-[#a0c81d]' : 'border-[#C5BFB5]'}`}>
                            {paymentMethod === 'stripe' && <div className="w-2 h-2 rounded-full bg-[#a0c81d]" />}
                          </div>
                          <CreditCard className={`w-4 h-4 shrink-0 ${paymentMethod === 'stripe' ? 'text-[#6B8A12]' : 'text-[#8A8177]'}`} aria-hidden="true" />
                          <div>
                            <span className={`text-sm font-semibold block ${paymentMethod === 'stripe' ? 'text-[#3D3D3D]' : 'text-[#6B6158]'}`}>Kort / Klarna</span>
                            <span className="text-[10px] text-[#8A8177]">Kort, Apple Pay eller Klarna</span>
                          </div>
                        </button>
                        <button type="button" onClick={() => { setPaymentMethod('friskvard'); setState({ phase: 'selecting' }); if (selectedPlanId === 'monthly') setSelectedPlanId('12m'); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 border-t border-[#E6E1D8] text-left transition ${paymentMethod === 'friskvard' ? 'bg-[#FAFAF5]' : 'bg-white hover:bg-[#FAFAF5]'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentMethod === 'friskvard' ? 'border-[#a0c81d]' : 'border-[#C5BFB5]'}`}>
                            {paymentMethod === 'friskvard' && <div className="w-2 h-2 rounded-full bg-[#a0c81d]" />}
                          </div>
                          <Dumbbell className={`w-4 h-4 shrink-0 ${paymentMethod === 'friskvard' ? 'text-[#6B8A12]' : 'text-[#8A8177]'}`} aria-hidden="true" />
                          <div>
                            <span className={`text-sm font-semibold block ${paymentMethod === 'friskvard' ? 'text-[#3D3D3D]' : 'text-[#6B6158]'}`}>Friskvårdsbidrag</span>
                            <span className="text-[10px] text-[#8A8177]">Betala via friskvårdsportal</span>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Error + CTA */}
                {(state.phase === 'selecting' || state.phase === 'error') && (
                  <div className="space-y-3">
                    {state.phase === 'error' && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /><span role="alert">{state.message}</span>
                      </div>
                    )}
                    <button type="button" onClick={handleStartPayment}
                      className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest bg-[#a0c81d] text-white hover:bg-[#8ab516] hover:shadow-lg hover:shadow-[#a0c81d]/20 active:scale-[0.98] transition-[background-color,box-shadow,transform] flex items-center justify-center gap-2">
                      Gå vidare <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {/* Loading */}
                {state.phase === 'loading' && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#a0c81d]" />
                    <span className="ml-2 text-sm text-[#6B6158]">Förbereder betalning…</span>
                  </div>
                )}

                {/* Stripe */}
                {state.phase === 'ready' && stripePromise && (
                  <Elements key={`${state.mode}-${state.clientSecret}`} stripe={stripePromise}
                    options={{ clientSecret: state.clientSecret, locale: 'sv', appearance: PTO_APPEARANCE }}>
                    <CheckoutForm plan={plan} email={email} returnUrl={returnUrl} />
                  </Elements>
                )}

                {/* Friskvård */}
                {state.phase === 'friskvard' && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-2">
                      <h3 className="text-sm font-bold text-blue-900">Betalning med friskvårdsbidrag</h3>
                      <p className="text-xs text-blue-700 leading-relaxed">Din beställning registreras direkt. Du får instruktioner via e-post om hur du slutför betalningen via din arbetsgivares friskvårdsportal.</p>
                      <div className="rounded-lg bg-white/80 border border-blue-200 p-3 text-xs text-blue-800 flex justify-between">
                        <span>Plan: <b>{plan.label}</b></span><span><b>{plan.price.toLocaleString('sv-SE')} kr</b></span>
                      </div>
                    </div>
                    <button type="button" onClick={async () => {
                      setState({ phase: 'loading' });
                      try {
                        const res = await fetch('/api/payments/create-checkout-session', {
                          method: 'POST', headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
                          body: JSON.stringify({ flow: plan.id === 'renewal' ? 'forlangning' : 'premium', mode: plan.id === 'renewal' ? 'payment' : plan.mode, paymentMethod: 'friskvardsbidrag', email, fullName, userId: session?.user?.id, planId: plan.id, planLabel: plan.label, planPrice: plan.price, planMonthCount: plan.monthCount || 0, ...(plan.id === 'renewal' && renewalOffer ? { forlangningOffer: { monthlyPrice: renewalOffer.monthlyPrice, monthCount: renewalOffer.monthCount, totalPrice: renewalOffer.totalPrice, campaignYear: renewalOffer.campaignYear, billableDays: renewalOffer.billableDays, calculationMode: renewalOffer.calculationMode, currentExpiresAt: renewalOffer.currentExpiresAt, billingStartsAt: renewalOffer.billingStartsAt, newExpiresAt: renewalOffer.newExpiresAt } } : {}) }),
                        });
                        const data = await res.json();
                        if (data.ok && data.friskvard) {
                          const pt = (plan.isRenewal||isActiveMember)?'renewal':'new_purchase';
                          window.dataLayer=window.dataLayer||[];window.dataLayer.push({ecommerce:null});
                          window.dataLayer.push({event:'purchase',ecommerce:{transaction_id:`friskvard_${data.friskvard_order_id||Date.now()}`,currency:'SEK',value:plan.price,payment_type:'friskvardsbidrag',items:[{item_id:plan.id,item_name:plan.label,item_category:pt,price:plan.price,currency:'SEK',quantity:1}]}});
                          window.dataLayer.push({event:pt==='renewal'?'pto_renewal_completed':'pto_new_purchase_completed',purchaseType:pt,paymentMethod:'friskvardsbidrag',planId:plan.id,value:plan.price});
                          navigate(`/tack-forlangning-friskvard?friskvard=1&plan=${encodeURIComponent(plan.label)}&price=${plan.price}`);
                        } else { setState({ phase: 'error', message: data.error || 'Kunde inte registrera.' }); }
                      } catch { setState({ phase: 'error', message: 'Oväntat fel.' }); }
                    }} className="w-full py-3.5 rounded-xl font-black text-sm uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center gap-2">
                      Bekräfta friskvårdsbeställning
                    </button>
                    <button type="button" onClick={() => { setPaymentMethod('stripe'); setState({ phase: 'selecting' }); }}
                      className="w-full py-2 text-xs text-[#8A8177] font-bold hover:text-[#3D3D3D] transition">← Byt till kort / Klarna</button>
                  </div>
                )}
              </div>

              {/* Card footer */}
              <div className="bg-[#FAFAF5] border-t border-[#E6E1D8] px-5 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#8A8177] font-medium flex items-center gap-1">
                    <Lock className="w-3 h-3" aria-hidden="true" /> Säker betalning · Krypterat via Stripe
                  </span>
                  <PaymentMethodBadges />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FAQ ═══ */}
      <section className="py-12 px-4">
        <div className="max-w-[680px] mx-auto">
          <h2 className="text-[11px] font-black uppercase tracking-[0.15em] text-[#a0c81d] mb-4">Vanliga frågor</h2>
          <div className="space-y-1.5">
            {FAQ.map(({ q, a }, i) => (
              <div key={q} className="rounded-xl border border-[#DDD8CD] bg-white overflow-hidden">
                <button type="button" onClick={() => { setOpenFaq(prev => { const n = prev === i ? null : i; if (n !== null) pushEvent('faq_click', { question: q }); return n; }); }}
                  className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <span className="text-[13px] font-bold text-[#3D3D3D] pr-4">{q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#8A8177] shrink-0 transition-transform motion-reduce:transition-none ${openFaq === i ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <div className={`overflow-hidden transition-[max-height,opacity] duration-200 motion-reduce:transition-none ${openFaq === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="px-4 pb-3 text-xs text-[#6B6158] leading-relaxed">{a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-[#DDD8CD]">
        <p className="text-center text-[10px] text-[#8A8177]">
          © {new Date().getFullYear()} Private Training Online · Org.nr 559387-3108 ·{' '}
          <a href="https://www.privatetrainingonline.se" className="underline hover:text-[#3D3D3D] transition">privatetrainingonline.se</a>
        </p>
      </footer>
    </div>
  );
};

export default BliKlient;
