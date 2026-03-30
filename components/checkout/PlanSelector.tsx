import React from 'react';
import { Check, Sparkles, Clock } from 'lucide-react';
import type { CheckoutPlan } from '../../lib/checkoutPlans';

interface PlanSelectorProps {
  plans: CheckoutPlan[];
  selectedPlanId: string;
  onSelect: (planId: string) => void;
}

export const PlanSelector: React.FC<PlanSelectorProps> = ({
  plans,
  selectedPlanId,
  onSelect,
}) => {
  return (
    <div className="space-y-3">
      {plans.map((plan) => {
        const isSelected = plan.id === selectedPlanId;
        const isPopular = !!plan.badge;

        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelect(plan.id)}
            className={`
              group relative w-full text-left rounded-2xl border-2 p-4 transition-all duration-200
              ${isSelected
                ? 'border-[#a0c81d] bg-[#f5fae6] shadow-lg shadow-[#a0c81d]/10'
                : 'border-[#E6E1D8] bg-white/80 hover:border-[#c5d69b] hover:bg-white'
              }
              ${isPopular && !isSelected ? 'ring-1 ring-[#a0c81d]/30' : ''}
            `}
            aria-pressed={isSelected}
          >
            {/* Badge */}
            {isPopular && (
              <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-[#a0c81d] px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
                <Sparkles className="w-3 h-3" />
                {plan.badge}
              </span>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Radio indicator */}
                <div
                  className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    transition-all duration-200
                    ${isSelected
                      ? 'border-[#a0c81d] bg-[#a0c81d]'
                      : 'border-[#D5CFC6] group-hover:border-[#a0c81d]/50'
                    }
                  `}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>

                {/* Plan info */}
                <div>
                  <span className="text-sm font-bold text-[#3D3D3D]">{plan.label}</span>
                  {plan.description && (
                    <span className="ml-2 text-xs text-[#8A8177] font-medium">
                      {plan.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0 ml-4">
                {plan.mode === 'subscription' ? (
                  <div>
                    <span className="text-base font-black text-[#3D3D3D]">
                      {plan.price.toLocaleString('sv-SE')} kr
                    </span>
                    <span className="text-xs text-[#8A8177] font-medium">/mån</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-base font-black text-[#3D3D3D]">
                      {plan.price.toLocaleString('sv-SE')} kr
                    </span>
                    <div className="text-[11px] text-[#8A8177] font-medium">
                      {plan.perMonth.toLocaleString('sv-SE')} kr/mån
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Savings badge */}
            {plan.savings && (
              <div className="mt-2 ml-8">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                  <Clock className="w-3 h-3" />
                  {plan.savings} jämfört med månadsvis
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PlanSelector;
