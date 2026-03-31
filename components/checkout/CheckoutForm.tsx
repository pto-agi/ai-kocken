import React, { useState, useCallback } from 'react';
import {
  PaymentElement,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import type { StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js';
import { Loader2, AlertTriangle, Lock } from 'lucide-react';
import type { CheckoutPlan } from '../../lib/checkoutPlans';

interface CheckoutFormProps {
  plan: CheckoutPlan;
  email: string;
  returnUrl: string;
  onPaymentSuccess?: () => void;
}

export const CheckoutForm: React.FC<CheckoutFormProps> = ({
  plan,
  email,
  returnUrl,
  onPaymentSuccess,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // Trial subscriptions use SetupIntent (no charge today), regular use PaymentIntent
      const confirmFn = plan.isTrial ? stripe.confirmSetup : stripe.confirmPayment;
      const { error } = await confirmFn({
        elements,
        confirmParams: {
          return_url: returnUrl,
          ...(plan.isTrial ? {} : { receipt_email: email }),
        },
      } as any);

      if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
          setErrorMessage(error.message || 'Betalningen misslyckades.');
        } else {
          setErrorMessage('Ett oväntat fel uppstod. Försök igen.');
        }
      } else {
        onPaymentSuccess?.();
      }
    } catch (err) {
      setErrorMessage('Kunde inte genomföra betalningen. Kontrollera dina uppgifter.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExpressCheckoutConfirm = useCallback(
    async (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements) return;

      const confirmFn = plan.isTrial ? stripe.confirmSetup : stripe.confirmPayment;
      const { error } = await confirmFn({
        elements,
        clientSecret: undefined as any, // Elements already has the secret
        confirmParams: {
          return_url: returnUrl,
          ...(plan.isTrial ? {} : { receipt_email: email }),
        },
      } as any);

      if (error) {
        setErrorMessage(error.message || 'Express checkout misslyckades.');
      }
    },
    [stripe, elements, returnUrl, email],
  );

  const ctaLabel = plan.isTrial
    ? 'Starta gratis provperiod'
    : plan.mode === 'subscription'
      ? 'Starta prenumeration'
      : 'Slutför köp';

  return (
    <div className="space-y-6">
      {/* Express Checkout (Apple Pay, Google Pay, Klarna, Link) */}
      <div>
        <ExpressCheckoutElement
          onConfirm={handleExpressCheckoutConfirm}
          options={{
            buttonType: {
              applePay: 'plain',
              googlePay: 'plain',
            },
            layout: {
              maxRows: 2,
              maxColumns: 2,
            },
          }}
        />
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#E6E1D8]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-4 text-[#8A8177] font-medium uppercase tracking-wider">
            Eller betala med kort
          </span>
        </div>
      </div>

      {/* Payment Element (card form) */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <PaymentElement
          options={{
            layout: {
              type: 'accordion',
              defaultCollapsed: false,
              radios: true,
              spacedAccordionItems: false,
            },
            defaultValues: {
              billingDetails: {
                email,
              },
            },
            business: {
              name: 'Private Training Online',
            },
          }}
        />

        {/* Error message */}
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="
            w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest
            transition-all duration-200
            bg-[#a0c81d] text-white
            hover:bg-[#8ab516] hover:shadow-lg hover:shadow-[#a0c81d]/20
            active:scale-[0.98]
            disabled:opacity-60 disabled:cursor-not-allowed
            flex items-center justify-center gap-2
          "
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Bearbetar...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              {ctaLabel}
            </>
          )}
        </button>

        {/* Security note */}
        <p className="text-center text-[10px] text-[#8A8177] font-medium flex items-center justify-center gap-1">
          <Lock className="w-3 h-3" />
          Krypterad betalning via Stripe · Dina uppgifter är skyddade
        </p>
      </form>
    </div>
  );
};

export default CheckoutForm;
