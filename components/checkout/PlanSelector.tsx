import React from 'react';
import { Star, Timer } from 'lucide-react';
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
    <div className="space-y-4">
      {/* Renewal highlight card (if present) */}
      {renewalPlans.map((plan) => {
        const isSelected = plan.id === selectedPlanId;

        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelect(plan.id)}
            className={`
              group relative w-full text-left rounded-xl border-2 p-4 transition-all duration-200
              ${isSelected
                ? 'border-[#a0c81d] bg-gradient-to-br from-[#f5fae6] to-[#eef5d6] shadow-md shadow-[#a0c81d]/10'
                : 'border-[#d9e8a0] bg-gradient-to-br from-[#f5fae6]/60 to-[#eef5d6]/60 hover:border-[#a0c81d] hover:shadow-sm'
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
                {/* Radio indicator — Stripe-style hollow circle with dot */}
                <div
                  className={`
                    w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0
                    transition-colors duration-150
                    ${isSelected ? 'border-[#a0c81d]' : 'border-[#C5BFB5] group-hover:border-[#a0c81d]/60'}
                  `}
                >
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#a0c81d]" />}
                </div>

                {/* Plan info */}
                <div>
                  <span className="text-sm font-semibold text-[#3D3D3D]">{plan.label}</span>
                  {plan.description && (
                    <div className="text-xs text-[#6B8A12] font-medium mt-0.5">
                      {plan.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0 ml-4">
                <span className="text-sm font-bold text-[#3D3D3D]">
                  {plan.price.toLocaleString('sv-SE')} kr
                </span>
                <div className="text-[11px] text-[#6B8A12] font-medium">
                  {plan.perMonth.toLocaleString('sv-SE')} kr/mån
                </div>
              </div>
            </div>

            {/* Urgency badge */}
            {plan.urgencyText && (
              <div className="mt-2.5 ml-[30px]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wide">
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

      {/* Standard plans — compact accordion list matching Stripe's radio style */}
      {standardPlans.length > 0 && (
        <div className="rounded-xl border border-[#E6E1D8] overflow-hidden">
          {standardPlans.map((plan, index) => {
            const isSelected = plan.id === selectedPlanId;

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => onSelect(plan.id)}
                className={`
                  group relative w-full text-left px-4 py-3 transition-all duration-150
                  ${index > 0 ? 'border-t border-[#E6E1D8]' : ''}
                  ${isSelected
                    ? 'bg-[#FAFAF5]'
                    : 'bg-white hover:bg-[#FAFAF5]'
                  }
                `}
                aria-pressed={isSelected}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Radio indicator — Stripe-style hollow circle with dot */}
                    <div
                      className={`
                        w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0
                        transition-colors duration-150
                        ${isSelected ? 'border-[#a0c81d]' : 'border-[#C5BFB5] group-hover:border-[#a0c81d]/60'}
                      `}
                    >
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#a0c81d]" />}
                    </div>

                    {/* Plan info */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-[#3D3D3D]">{plan.label}</span>
                      {plan.description && (
                        <span className="text-[11px] text-[#8A8177] font-medium">
                          {plan.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0 ml-4">
                    {plan.mode === 'subscription' ? (
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-sm font-bold text-[#3D3D3D]">
                          {plan.price.toLocaleString('sv-SE')} kr
                        </span>
                        <span className="text-[11px] text-[#8A8177] font-medium">/mån</span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="text-sm font-bold text-[#3D3D3D]">
                            {plan.price.toLocaleString('sv-SE')} kr
                          </span>
                        </div>
                        <div className="text-[11px] text-[#8A8177] font-medium">
                          {plan.perMonth.toLocaleString('sv-SE')} kr/mån
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlanSelector;
