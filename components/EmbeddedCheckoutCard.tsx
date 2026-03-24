import React, { useMemo, useState } from 'react';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { ArrowRight, AlertTriangle } from 'lucide-react';

import type { CreateCheckoutSessionPayload } from '../lib/paymentTypes';
import { getStripePublishableKeyClient } from '../utils/paymentFeatureFlags';
import { createCheckoutSession } from '../utils/paymentsClient';
import { trackCheckoutEvent } from '../utils/paymentAnalytics';

type EmbeddedCheckoutCardProps = {
  payload: CreateCheckoutSessionPayload;
  accessToken?: string | null;
  buttonLabel?: string;
  className?: string;
  disabled?: boolean;
  onSessionCreated?: (sessionId: string) => void;
};

export const EmbeddedCheckoutCard: React.FC<EmbeddedCheckoutCardProps> = ({
  payload,
  accessToken,
  buttonLabel = 'Gå till säker betalning',
  className = '',
  disabled = false,
  onSessionCreated,
}) => {
  const [isStarting, setIsStarting] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string>(getStripePublishableKeyClient());
  const [error, setError] = useState<string | null>(null);

  const stripePromise = useMemo(() => {
    if (!publishableKey) return null;
    return loadStripe(publishableKey);
  }, [publishableKey]);

  const startCheckout = async () => {
    if (disabled || isStarting) return;
    setError(null);
    setIsStarting(true);

    try {
      const response = await createCheckoutSession(payload, accessToken);
      if (!response.ok) {
        throw new Error(response.error || 'Kunde inte starta checkout');
      }

      if (response.fallback && response.fallback_url) {
        window.location.href = response.fallback_url;
        return;
      }

      if (!response.client_secret) {
        throw new Error('Stripe checkout kunde inte startas (saknar client secret).');
      }

      if (response.publishable_key) {
        setPublishableKey(response.publishable_key);
      }

      setClientSecret(response.client_secret);
      if (response.session_id) {
        onSessionCreated?.(response.session_id);
        trackCheckoutEvent('checkout_started', {
          flow: payload.flow,
          mode: payload.mode,
          sessionId: response.session_id,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte starta checkout.');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className={className}>
      {!clientSecret && (
        <button
          type="button"
          disabled={disabled || isStarting}
          onClick={startCheckout}
          className="w-full px-6 py-3 rounded-xl bg-[#a0c81d] text-[#F6F1E7] text-xs font-black uppercase tracking-widest hover:bg-[#5C7A12] transition inline-flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isStarting ? 'Startar checkout...' : buttonLabel}
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {error && (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {clientSecret && stripePromise && (
        <div className="mt-4 rounded-2xl border border-[#E6E1D8] bg-white p-2 md:p-3">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{
              clientSecret,
              onComplete: () => {
                trackCheckoutEvent('checkout_completed', {
                  flow: payload.flow,
                  mode: payload.mode,
                });
              },
            }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}
    </div>
  );
};

export default EmbeddedCheckoutCard;
