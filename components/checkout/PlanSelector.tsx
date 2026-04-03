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
  // Split special plans (renewal/trial) from standard plans
  const specialPlans = plans.filter((p) => p.isRenewal || p.isTrial);
  const standardPlans = plans.filter((p) => !p.isRenewal && !p.isTrial);

  return (
    <div className="space-y-4">
      {/* Special plans: renewal or trial highlight cards */}
      {specialPlans.map((plan) => {
        const isSelected = plan.id === selectedPlanId;

        return (
          <button
            key={plan.id}
            type="button"
            onClick={() => onSelect(plan.id)}
            className={`
              group relative w-full text-left rounded-xl border-2 p-4 transition-all duration-200
              ${isSelected
                ? plan.isTrial
                  ? 'border-[#22c55e] bg-gradient-to-br from-[#ecfdf5] to-[#d1fae5] shadow-md shadow-[#22c55e]/10'
                  : 'border-[#a0c81d] bg-gradient-to-br from-[#f5fae6] to-[#eef5d6] shadow-md shadow-[#a0c81d]/10'
                : plan.isTrial
                  ? 'border-[#86efac] bg-gradient-to-br from-[#ecfdf5]/60 to-[#d1fae5]/60 hover:border-[#22c55e] hover:shadow-sm'
                  : 'border-[#d9e8a0] bg-gradient-to-br from-[#f5fae6]/60 to-[#eef5d6]/60 hover:border-[#a0c81d] hover:shadow-sm'
              }
            `}
            aria-pressed={isSelected}
          >
            {/* Badge */}
            <span className={`absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-white shadow-sm ${
              plan.isTrial ? 'bg-[#22c55e]' : 'bg-[#a0c81d]'
            }`}>
              <Star className="w-3 h-3" />
              {plan.badge}
            </span>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Radio indicator */}
                <div
                  className={`
                    w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center flex-shrink-0
                    transition-colors duration-150
                    ${isSelected
                      ? plan.isTrial ? 'border-[#22c55e]' : 'border-[#a0c81d]'
                      : plan.isTrial ? 'border-[#86efac] group-hover:border-[#22c55e]/60' : 'border-[#C5BFB5] group-hover:border-[#a0c81d]/60'
                    }
                  `}
                >
                  {isSelected && <div className={`w-2.5 h-2.5 rounded-full ${plan.isTrial ? 'bg-[#22c55e]' : 'bg-[#a0c81d]'}`} />}
                </div>

                {/* Plan info */}
                <div>
                  <span className="text-sm font-semibold text-[#3D3D3D]">{plan.label}</span>
                  {plan.description && (
                    <div className={`text-xs font-medium mt-0.5 ${plan.isTrial ? 'text-[#16a34a]' : 'text-[#6B8A12]'}`}>
                      {plan.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Price */}
              <div className="text-right flex-shrink-0 ml-4">
                {plan.isTrial ? (
                  <>
                    <span className="text-sm font-bold text-[#16a34a]">Gratis</span>
                    <div className="text-[11px] text-[#6B6158] font-medium">i 30 dagar</div>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-bold text-[#3D3D3D]">
                      {plan.price.toLocaleString('sv-SE')} kr
                    </span>
                    <div className="text-[11px] text-[#6B8A12] font-medium">
                      {plan.perMonth.toLocaleString('sv-SE')} kr/mån
                    </div>
                  </>
                )}
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

      {/* Separator between special and standard plans */}
      {specialPlans.length > 0 && standardPlans.length > 0 && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-[#3D3D3D]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#8A8177]">Eller välj ny plan</span>
          <div className="flex-1 border-t border-[#3D3D3D]" />
        </div>
      )}

      {/* Standard plans — compact accordion list matching Stripe's radio style */}
      {standardPlans.length > 0 && (
        <div className="rounded-xl border border-[#3D3D3D] overflow-hidden">
          {standardPlans.map((plan, index) => {
            const isSelected = plan.id === selectedPlanId;

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => onSelect(plan.id)}
                className={`
                  group relative w-full text-left px-4 py-3 transition-all duration-150
                  ${index > 0 ? 'border-t border-[#3D3D3D]' : ''}
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
                    <div>
                      <span className="text-sm font-semibold text-[#3D3D3D]">{plan.label}</span>
                      {plan.description && (
                        <div className="text-[11px] text-[#8A8177] font-medium mt-0.5">
                          {plan.description}
                        </div>
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
