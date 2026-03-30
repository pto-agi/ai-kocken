import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Smartphone,
  Mail,
  ArrowRight,
  Download,
  PartyPopper,
  Loader2,
} from 'lucide-react';

import { CheckoutHeader } from '../components/checkout/CheckoutHeader';
import { trackCheckoutEvent } from '../utils/paymentAnalytics';

const NEXT_STEPS = [
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

export const CheckoutSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    trackCheckoutEvent('checkout_completed', { flow: 'checkout' as any });

    // GA4 e-commerce: purchase (conversion event for Google Ads)
    if (typeof window !== 'undefined') {
      const sessionId = searchParams.get('session_id') || searchParams.get('payment_intent') || '';
      // Try to recover plan info from sessionStorage (set during checkout)
      let planId = 'unknown';
      let planLabel = 'PTO Coaching';
      let planPrice = 0;
      let planCurrency = 'SEK';
      try {
        const stored = sessionStorage.getItem('pto_checkout_plan');
        if (stored) {
          const parsed = JSON.parse(stored);
          planId = parsed.id || planId;
          planLabel = parsed.label || planLabel;
          planPrice = parsed.price || planPrice;
          planCurrency = parsed.currency || planCurrency;
        }
      } catch {
        // noop
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ ecommerce: null }); // Clear previous
      window.dataLayer.push({
        event: 'purchase',
        ecommerce: {
          transaction_id: sessionId || `pto_${Date.now()}`,
          value: planPrice,
          currency: planCurrency,
          items: [{
            item_id: planId,
            item_name: planLabel,
            price: planPrice,
            currency: planCurrency,
            quantity: 1,
          }],
        },
      });

      // Clean up
      try { sessionStorage.removeItem('pto_checkout_plan'); } catch { /* noop */ }
    }

    // Auto-hide confetti after animation
    const timeout = setTimeout(() => setShowConfetti(false), 5000);
    return () => clearTimeout(timeout);
  }, []);

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
            Välkommen till PTO! 🎉
          </h1>
          <p className="text-sm text-[#6B6158] font-medium max-w-sm mx-auto mb-10">
            Din betalning är bekräftad och ditt konto förbereds. Du är nu en del av teamet!
          </p>

          {/* Next steps */}
          <div className="space-y-4 text-left mb-10">
            {NEXT_STEPS.map((step, i) => (
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
              Logga in på myPTO
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
