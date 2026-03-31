import React from 'react';
import { Check, Sparkles, Clock, Star, Timer } from 'lucide-react';
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
  // Split renewal plans from standard plans
  const renewalPlans = plans.filter((p) => p.isRenewal);
  const standardPlans = plans.filter((p) => !p.isRenewal);

  return (
    <div className="space-y-3">
      {/* Renewal highlight card (if present) */}
      {renewalPlans.map((plan) => {
        const isSelected = plan.id === selectedPlanId;

        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelect(plan.id)}
            className={`
              group relative w-full text-left rounded-2xl border-2 p-5 transition-all duration-200
              ${isSelected
                ? 'border-[#a0c81d] bg-gradient-to-br from-[#f5fae6] to-[#eef5d6] shadow-lg shadow-[#a0c81d]/15'
                : 'border-[#d9e8a0] bg-gradient-to-br from-[#f5fae6]/60 to-[#eef5d6]/60 hover:border-[#a0c81d] hover:shadow-md'
              }
            `}
            aria-pressed={isSelected}
          >
            {/* Badge */}
            <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-[#a0c81d] px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
              <Star className="w-3 h-3" />
              {plan.badge}
            </span>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Radio indicator */}
                <div
                  className={`
                    w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    transition-all duration-200
                    ${isSelected
                      ? 'border-[#a0c81d] bg-[#a0c81d]'
                      : 'border-[#c5d69b] group-hover:border-[#a0c81d]'
                    }
                  `}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </div>

                {/* Plan info */}
                <div>
                  <span className="text-sm font-bold text-[#3D3D3D]">{plan.label}</span>
                  {plan.description && (
                    <div className="text-xs text-[#6B8A12] font-medium mt-0.5">
                      {plan.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0 ml-4">
                <span className="text-base font-black text-[#3D3D3D]">
                  {plan.price.toLocaleString('sv-SE')} kr
                </span>
                <div className="text-[11px] text-[#6B8A12] font-medium">
                  {plan.perMonth.toLocaleString('sv-SE')} kr/mån
                </div>
              </div>
            </div>

            {/* Urgency badge */}
            {plan.urgencyText && (
              <div className="mt-3 ml-8">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                  <Timer className="w-3 h-3 animate-pulse" />
                  {plan.urgencyText}
                </span>
              </div>
            )}
          </button>
        );
      })}

      {/* Separator between renewal and standard plans */}
      {renewalPlans.length > 0 && standardPlans.length > 0 && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-[#E6E1D8]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">Eller välj ny plan</span>
          <div className="flex-1 border-t border-[#E6E1D8]" />
        </div>
      )}

      {/* Standard plans */}
      {standardPlans.map((plan) => {
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
