import React, { useState } from 'react';
import {
  Shield,
  Zap,
  CreditCard,
  Star,
  ChevronDown,
  CheckCircle2,
  Dumbbell,
  Utensils,
  BarChart3,
  Smartphone,
  MessageCircle,
} from 'lucide-react';
import type { CheckoutPlan } from '../../lib/checkoutPlans';

interface CheckoutSummaryProps {
  plan: CheckoutPlan;
}

const FEATURES = [
  { icon: Dumbbell, label: 'Personlig coach & skräddarsytt program' },
  { icon: Utensils, label: 'AI-recept & veckomenyer' },
  { icon: BarChart3, label: 'Uppföljning & ny planering varje månad' },
  { icon: Smartphone, label: 'Direkt via app i mobilen' },
  { icon: MessageCircle, label: 'Direkt kontakt med ditt team' },
];

const FAQ_ITEMS = [
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
    a: 'Ja! Välj "Friskvårdsbidrag" som betalmetod i checkout. Du kan betala hela eller delar via din arbetsgivares friskvårdsportal.',
  },
];

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({ plan }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {/* Selected plan summary */}
      <div className="rounded-2xl bg-gradient-to-br from-[#f5fae6] to-[#eef5d6] border border-[#d9e8a0] p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-widest text-[#6B8A12]">
            Din plan
          </span>
          <span className="text-xs text-[#8A8177] font-medium">
            {plan.label}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-[#3D3D3D]">
            {plan.price.toLocaleString('sv-SE')}
          </span>
          <span className="text-lg font-bold text-[#6B6158]">kr</span>
          {plan.mode === 'subscription' && (
            <span className="text-sm text-[#8A8177] font-medium">/mån</span>
          )}
        </div>
        {plan.mode === 'payment' && plan.perMonth && (
          <p className="text-xs text-[#6B8A12] font-medium mt-1">
            Motsvarar {plan.perMonth.toLocaleString('sv-SE')} kr/mån
          </p>
        )}
      </div>

      {/* Features */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#8A8177]">
          Det här ingår
        </h3>
        <ul className="space-y-2.5">
          {FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#a0c81d] mt-0.5 flex-shrink-0" />
              <span className="text-sm text-[#3D3D3D] font-medium">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Trust signals */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { icon: Shield, label: 'Krypterad betalning' },
          { icon: Zap, label: 'Ingen bindningstid' },
          { icon: CreditCard, label: 'Säker via Stripe' },
          { icon: Star, label: '4.9/5 · 500+ klienter' },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-xl bg-white/60 border border-[#E6E1D8] px-3 py-2"
          >
            <Icon className="w-3.5 h-3.5 text-[#a0c81d] flex-shrink-0" />
            <span className="text-[10px] font-bold text-[#6B6158] uppercase tracking-wide">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#8A8177]">
          Vanliga frågor
        </h3>
        {FAQ_ITEMS.map(({ q, a }, i) => (
          <div
            key={q}
            className="rounded-xl border border-[#E6E1D8] bg-white/60 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-xs font-bold text-[#3D3D3D]">{q}</span>
              <ChevronDown
                className={`w-4 h-4 text-[#8A8177] transition-transform duration-200 ${
                  openFaq === i ? 'rotate-180' : ''
                }`}
              />
            </button>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                openFaq === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <p className="px-4 pb-3 text-xs text-[#6B6158] font-medium leading-relaxed">
                {a}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CheckoutSummary;
