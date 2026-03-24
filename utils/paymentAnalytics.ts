type CheckoutEventName = 'checkout_started' | 'checkout_completed';

type CheckoutEventPayload = {
  flow: 'premium' | 'forlangning' | 'refill';
  mode: 'payment' | 'subscription';
  sessionId?: string;
};

export function trackCheckoutEvent(name: CheckoutEventName, payload: CheckoutEventPayload): void {
  if (typeof window === 'undefined') return;

  const eventPayload = {
    event: name,
    flow: payload.flow,
    mode: payload.mode,
    session_id: payload.sessionId || null,
    timestamp: new Date().toISOString(),
  };

  const dataLayer = (window as any).dataLayer;
  if (Array.isArray(dataLayer)) {
    dataLayer.push(eventPayload);
  }

  if (process.env.NODE_ENV !== 'production') {
    // Useful while wiring analytics and validating the funnel locally.
    console.info('[payments:event]', eventPayload);
  }
}
