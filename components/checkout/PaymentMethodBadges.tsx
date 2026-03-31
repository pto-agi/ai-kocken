import React, { useMemo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentMethodMessagingElement } from '@stripe/react-stripe-js';
import { getStripePublishableKeyClient } from '../../utils/paymentFeatureFlags';
import type { CheckoutPlan } from '../../lib/checkoutPlans';

interface PaymentMethodBadgesProps {
  plan: CheckoutPlan | null;
}

/**
 * Displays Stripe Payment Method Messaging Element — shows
 * available BNPL / payment options (Klarna, etc.) with logos.
 * Wrapped in its own Elements provider so it works before the
 * payment session is created.
 */
export const PaymentMethodBadges: React.FC<PaymentMethodBadgesProps> = ({ plan }) => {
  const stripePromise = useMemo(() => {
    const pk = getStripePublishableKeyClient();
    if (!pk) return null;
    return loadStripe(pk, { locale: 'sv' });
  }, []);

  if (!stripePromise || !plan) return null;

  // Amount in smallest currency unit (öre for SEK)
  const amount = plan.price * 100;

  return (
    <Elements stripe={stripePromise}>
      <PaymentMethodMessagingElement
        options={{
          amount,
          currency: 'SEK',
          countryCode: 'SE',
          paymentMethodTypes: ['klarna'],
        }}
      />
    </Elements>
  );
};

export default PaymentMethodBadges;
