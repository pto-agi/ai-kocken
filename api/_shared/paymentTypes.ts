import type { CheckoutFlow, CheckoutMode } from './paymentConstants';

export type RefillCheckoutItem = {
  id: string;
  qty: number;
};

export type RefillShipping = {
  name: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  country: string;
  phone: string;
};

export type ForlangningOfferPayload = {
  monthlyPrice: number;
  monthCount: number;
  totalPrice: number;
  campaignYear: number;
  billableDays: number;
  calculationMode: string;
  currentExpiresAt: string | null;
  billingStartsAt: string;
  newExpiresAt: string;
};

export type CreateCheckoutSessionPayload = {
  flow: CheckoutFlow;
  mode: CheckoutMode;
  email?: string;
  userId?: string;
  fullName?: string;
  forlangningOffer?: ForlangningOfferPayload;
  refillItems?: RefillCheckoutItem[];
  refillShipping?: RefillShipping;
  successPath?: string;
  cancelPath?: string;
};

export type CreateCheckoutSessionResponse = {
  ok: boolean;
  fallback?: boolean;
  fallback_url?: string;
  session_id?: string;
  client_secret?: string;
  publishable_key?: string;
  flow?: CheckoutFlow;
  mode?: CheckoutMode;
  error?: string;
};
