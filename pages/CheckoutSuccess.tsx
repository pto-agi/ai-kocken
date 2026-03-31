import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Smartphone,
  Mail,
  ArrowRight,
  Download,
  PartyPopper,
  RefreshCw,
} from 'lucide-react';

import { CheckoutHeader } from '../components/checkout/CheckoutHeader';
import { trackCheckoutEvent } from '../utils/paymentAnalytics';

type PurchaseType = 'new_purchase' | 'renewal';

interface StoredPlan {
  id: string;
  label: string;
  price: number;
  currency: string;
  purchaseType: PurchaseType;
  email: string;
  fullName: string;
  monthCount: number;
  newExpiresAt: string;
}

const NEW_PURCHASE_STEPS = [
  {
    icon: Mail,
    title: 'Kolla din inkorg',
    description: 'Du får ett bekräftelsemeddelande med logga in-instruktioner inom ett par minuter.',
  },
  {
    icon: Smartphone,
    title: 'Ladda ner appen',
    description: 'Installera Trainerize i App Store eller Google Play och logga in med din e-post.',
  },
  {
    icon: Download,
    title: 'Registrera dig på myPTO',
    description: 'Skapa ett konto på my.privatetrainingonline.se för att se din kosthållning, recept och uppföljning.',
  },
];

const RENEWAL_STEPS = [
  {
    icon: CheckCircle2,
    title: 'Förlängningen är registrerad',
    description: 'Ditt utgångsdatum uppdateras automatiskt. Du behöver inte göra något mer.',
  },
  {
    icon: RefreshCw,
    title: 'Fortsätt som vanligt',
    description: 'Dina tränings- och kostupplägg fortsätter utan avbrott. Din coach får ett meddelande.',
  },
  {
    icon: Mail,
    title: 'Bekräftelse via e-post',
    description: 'Du får en bekräftelse med ditt nya utgångsdatum till din registrerade e-postadress.',
  },
];

export const CheckoutSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showConfetti, setShowConfetti] = useState(true);
  const [storedPlan, setStoredPlan] = useState<StoredPlan | null>(null);

  useEffect(() => {
    // Recover plan data: try sessionStorage first, then URL query params as fallback
    let plan: StoredPlan | null = null;

    // Source 1: sessionStorage (set during checkout flow — same tab)
    try {
      const stored = sessionStorage.getItem('pto_checkout_plan');
      if (stored) {
        plan = JSON.parse(stored) as StoredPlan;
      }
    } catch {
      // noop
    }

    // Source 2: URL query params (fallback for redirect-based payments like Klarna)
    if (!plan) {
      const qPlanId = searchParams.get('plan_id');
      const qPrice = searchParams.get('plan_price');
      const qLabel = searchParams.get('plan_label');
      if (qPlanId && qPrice) {
        plan = {
          id: qPlanId,
          label: qLabel || qPlanId,
          price: Number(qPrice) || 0,
          currency: 'SEK',
          purchaseType: (searchParams.get('purchase_type') as PurchaseType) || 'new_purchase',
          email: searchParams.get('email') || '',
          fullName: searchParams.get('full_name') || '',
          monthCount: Number(searchParams.get('month_count') || 0),
          newExpiresAt: searchParams.get('new_expires_at') || '',
        };
      }
    }

    if (plan) setStoredPlan(plan);

    const purchaseType = plan?.purchaseType || 'new_purchase';
    trackCheckoutEvent('checkout_completed', { flow: 'checkout' as any });

    // GA4 e-commerce: purchase (conversion event for Google Ads)
    if (typeof window !== 'undefined') {
      const sessionId = searchParams.get('session_id') || searchParams.get('payment_intent') || '';

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ ecommerce: null }); // Clear previous
      window.dataLayer.push({
        event: 'purchase',
        ecommerce: {
          transaction_id: sessionId || `pto_${Date.now()}`,
          value: plan?.price || 0,
          currency: plan?.currency || 'SEK',
          items: [{
            item_id: plan?.id || 'unknown',
            item_name: plan?.label || 'PTO Coaching',
            item_category: purchaseType,
            price: plan?.price || 0,
            currency: plan?.currency || 'SEK',
            quantity: 1,
          }],
        },
      });

      // GA4 Enhanced Conversions: push user data for improved attribution
      if (plan?.email || plan?.fullName) {
        window.dataLayer.push({
          event: 'enhanced_conversion_data',
          enhanced_conversions: {
            email: plan?.email || '',
            ...(plan?.fullName ? {
              first_name: plan.fullName.split(' ')[0] || '',
              last_name: plan.fullName.split(' ').slice(1).join(' ') || '',
            } : {}),
          },
        });
      }

      // Custom event to distinguish renewal vs new_purchase in GA4
      window.dataLayer.push({
        event: purchaseType === 'renewal' ? 'pto_renewal_completed' : 'pto_new_purchase_completed',
        pto_purchase_type: purchaseType,
        pto_plan_id: plan?.id || '',
        pto_plan_label: plan?.label || '',
        pto_amount: plan?.price || 0,
        pto_month_count: plan?.monthCount || 0,
        pto_new_expires_at: plan?.newExpiresAt || '',
      });

      // Clean up
      try { sessionStorage.removeItem('pto_checkout_plan'); } catch { /* noop */ }
    }

    // Auto-hide confetti
    const timeout = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timeout);
  }, []);

  const isRenewal = storedPlan?.purchaseType === 'renewal';
  const steps = isRenewal ? RENEWAL_STEPS : NEW_PURCHASE_STEPS;

  return (
    <div className="min-h-screen bg-[#F6F1E7]">
      <CheckoutHeader />

      <main className="pt-24 pb-16 px-4">
        <div className="max-w-lg mx-auto text-center">
          {/* Success icon */}
          <div className="relative inline-flex mb-6">
            <div className="w-20 h-20 rounded-full bg-[#a0c81d] flex items-center justify-center shadow-lg shadow-[#a0c81d]/30 animate-[bounce_0.6s_ease-in-out]">
              <CheckCircle2 className="w-10 h-10 text-white" strokeWidth={2.5} />
            </div>
            {showConfetti && (
              <PartyPopper className="absolute -top-2 -right-2 w-6 h-6 text-yellow-500 animate-bounce" />
            )}
          </div>

          {/* Heading */}
          <h1 className="text-2xl md:text-3xl font-black text-[#3D3D3D] mb-2">
            {isRenewal ? 'Förlängningen är klar!' : 'Välkommen till PTO!'}
          </h1>
          <p className="text-sm text-[#6B6158] font-medium max-w-sm mx-auto mb-3">
            {isRenewal
              ? 'Din betalning är bekräftad och ditt medlemskap har förlängts.'
              : 'Din betalning är bekräftad och ditt konto förbereds. Du är nu en del av teamet!'
            }
          </p>

          {/* Purchase summary */}
          {storedPlan && (
            <div className="rounded-2xl bg-white border border-[#E6E1D8] p-4 mb-8 text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8177] mb-2">Sammanfattning</p>
              <div className="space-y-1 text-sm text-[#6B6158]">
                <div className="flex justify-between">
                  <span>Plan</span>
                  <span className="font-bold text-[#3D3D3D]">{storedPlan.label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Belopp</span>
                  <span className="font-bold text-[#3D3D3D]">{storedPlan.price.toLocaleString('sv-SE')} kr</span>
                </div>
                {storedPlan.newExpiresAt && (
                  <div className="flex justify-between">
                    <span>Nytt utgångsdatum</span>
                    <span className="font-bold text-[#3D3D3D]">{storedPlan.newExpiresAt}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next steps */}
          <div className="space-y-4 text-left mb-10">
            {steps.map((step, i) => (
              <div
                key={step.title}
                className="flex items-start gap-4 rounded-2xl bg-white border border-[#E6E1D8] p-4 shadow-sm"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="w-10 h-10 rounded-xl bg-[#f5fae6] flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-5 h-5 text-[#6B8A12]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#3D3D3D] mb-0.5">
                    {i + 1}. {step.title}
                  </h3>
                  <p className="text-xs text-[#6B6158] font-medium leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="
                w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest
                bg-[#a0c81d] text-white
                hover:bg-[#8ab516] hover:shadow-lg hover:shadow-[#a0c81d]/20
                active:scale-[0.98] transition-all duration-200
                flex items-center justify-center gap-2
              "
            >
              {isRenewal ? 'Till min profil' : 'Logga in på myPTO'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="https://www.privatetrainingonline.se"
              className="block w-full py-3 text-xs font-bold text-[#8A8177] hover:text-[#3D3D3D] transition"
            >
              Gå till privatetrainingonline.se →
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CheckoutSuccess;
