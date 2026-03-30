import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import type { Appearance } from '@stripe/stripe-js';
import {
  Loader2, AlertTriangle, Receipt, Lock, ArrowRight,
  Shield, Zap, Award, CheckCircle2,
} from 'lucide-react';

import { CHECKOUT_PLANS, DEFAULT_PLAN_ID, getPlanById } from '../lib/checkoutPlans';
import type { CheckoutPlan } from '../lib/checkoutPlans';
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

// ── Included features for summary ──

const INCLUDED = [
  'Personlig coach & träningsprogram',
  'AI-drivna veckomenyer med recept',
  'Månatlig uppföljning & ny planering',
  'Chatt med ditt team',
  'Allt i en app',
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

  const plan = useMemo(() => getPlanById(selectedPlanId) || CHECKOUT_PLANS[0], [selectedPlanId]);

  useEffect(() => {
    if (session?.user?.email && !email) setEmail(session.user.email);
    if (profile?.full_name && !fullName) setFullName(profile.full_name);
  }, [session, profile]);

  useEffect(() => {
    trackCheckoutEvent('checkout_started', { flow: 'checkout', mode: plan.mode });
    // GA4 / GTM
    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'begin_checkout',
        page_title: 'Checkout',
        page_path: '/checkout',
      });
    }
  }, []);

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

      {/* ═══ MAIN CONTENT ═══ */}
      <main className="pt-20 pb-12 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-xl md:text-2xl font-black text-[#3D3D3D] mb-1">
              Slutför ditt köp
            </h1>
            <p className="text-sm text-[#6B6158] font-medium">
              Välj plan och betala — du är igång på 2 minuter
            </p>
          </div>

          {/* Two-column layout */}
          <div className="flex flex-col lg:flex-row gap-8">

            {/* ── LEFT: Plan selection + Payment form ── */}
            <div className="lg:w-[60%] space-y-6">

              {/* Step 1: Plan selector */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[#a0c81d] text-white font-black text-[10px] flex items-center justify-center">1</div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#3D3D3D]">Välj plan</h2>
                </div>
                <PlanSelector
                  plans={CHECKOUT_PLANS}
                  selectedPlanId={selectedPlanId}
                  onSelect={handlePlanSelect}
                />
              </div>

              {/* Step 2: Payment */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-full bg-[#a0c81d] text-white font-black text-[10px] flex items-center justify-center">2</div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#3D3D3D]">Betalning</h2>
                </div>

                <div className="rounded-3xl bg-white border border-[#E6E1D8] shadow-xl shadow-black/[0.04] p-6 md:p-8">
                  {/* Payment method tabs */}
                  <div className="flex gap-2 mb-6">
                    <button
                      type="button"
                      onClick={() => { setPaymentMethod('stripe'); setState({ phase: 'selecting' }); }}
                      className={`
                        flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all
                        ${paymentMethod === 'stripe'
                          ? 'bg-[#a0c81d] text-white shadow-md shadow-[#a0c81d]/20'
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
                          ? 'bg-[#a0c81d] text-white shadow-md shadow-[#a0c81d]/20'
                          : 'bg-[#F6F1E7] text-[#6B6158] hover:bg-[#EDE8DD]'
                        }
                      `}
                    >
                      🏥 Friskvårdsbidrag
                    </button>
                  </div>

                  {/* Email & name + CTA */}
                  {(state.phase === 'selecting' || state.phase === 'error') && (
                    <div className="space-y-4 mb-4">
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

                  {/* Friskvårdsbidrag view */}
                  {state.phase === 'friskvard' && (
                    <div className="space-y-4 py-2">
                      <div className="rounded-2xl bg-blue-50 border border-blue-100 p-5 space-y-3">
                        <h3 className="text-sm font-bold text-blue-900">
                          Betalning med friskvårdsbidrag
                        </h3>
                        <p className="text-xs text-blue-700 leading-relaxed">
                          Din beställning registreras direkt. Du får instruktioner via e-post om hur
                          du slutför betalningen via din arbetsgivares friskvårdsportal.
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

                  {/* Security */}
                  <p className="text-center text-[10px] text-[#8A8177] font-medium flex items-center justify-center gap-1 mt-4">
                    <Lock className="w-3 h-3" />
                    Krypterad betalning via Stripe
                  </p>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Order summary ── */}
            <div className="lg:w-[40%]">
              <div className="lg:sticky lg:top-20 space-y-4">
                {/* Order summary */}
                <div className="rounded-3xl bg-white border border-[#E6E1D8] p-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[#8A8177] mb-4">
                    Din beställning
                  </h3>

                  {/* Selected plan */}
                  <div className="rounded-2xl bg-gradient-to-br from-[#f5fae6] to-[#eef5d6] border border-[#d9e8a0] p-4 mb-5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-[#3D3D3D]">{plan.label}</span>
                      <span className="text-xs text-[#6B8A12] font-bold">{plan.badge || ''}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-[#3D3D3D]">{plan.price.toLocaleString('sv-SE')}</span>
                      <span className="text-base font-bold text-[#6B6158]">kr</span>
                      {plan.mode === 'subscription' && <span className="text-xs text-[#8A8177] font-medium">/mån</span>}
                    </div>
                    {plan.mode === 'payment' && plan.perMonth && (
                      <p className="text-[10px] text-[#6B8A12] font-medium mt-1">
                        Motsvarar {plan.perMonth.toLocaleString('sv-SE')} kr/mån
                      </p>
                    )}
                  </div>

                  {/* What's included */}
                  <div className="space-y-2.5 mb-5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177]">Det här ingår</p>
                    {INCLUDED.map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#a0c81d] mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-[#3D3D3D] font-medium">{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-[#E6E1D8] pt-4">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-[#3D3D3D]">Totalt</span>
                      <div className="text-right">
                        <span className="text-lg font-black text-[#3D3D3D]">{plan.price.toLocaleString('sv-SE')} kr</span>
                        {plan.mode === 'subscription' && (
                          <span className="text-xs text-[#8A8177] font-medium"> /mån</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trust strip */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Shield, label: 'Säker betalning' },
                    { icon: Zap, label: 'Ingen bindning' },
                    { icon: Award, label: 'Friskvårdsgodkänd' },
                  ].map(({ icon: Icon, label }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-1 rounded-xl bg-white/60 border border-[#E6E1D8] p-3 text-center"
                    >
                      <Icon className="w-4 h-4 text-[#a0c81d]" />
                      <span className="text-[9px] font-bold text-[#8A8177] uppercase tracking-wider leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

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

export default Checkout;
