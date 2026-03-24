-- ============================================
-- PTO App – Payments v2 (Stripe + Webhooks)
-- Kör detta i Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS billing_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_customers_user_id ON billing_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_customers_email ON billing_customers(email);

CREATE TABLE IF NOT EXISTS billing_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID,
  email TEXT,
  flow TEXT NOT NULL CHECK (flow IN ('premium', 'forlangning', 'refill')),
  mode TEXT NOT NULL CHECK (mode IN ('payment', 'subscription')),
  status TEXT NOT NULL DEFAULT 'created',
  amount NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'SEK',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_transactions_user_id ON billing_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_email ON billing_transactions(email);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_flow ON billing_transactions(flow);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_status ON billing_transactions(status);
CREATE INDEX IF NOT EXISTS idx_billing_transactions_subscription_id ON billing_transactions(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_id ON billing_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_email ON billing_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_status ON billing_subscriptions(status);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'processed', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_type ON billing_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_status ON billing_webhook_events(status);

CREATE TABLE IF NOT EXISTS pending_entitlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  entitlement_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_entitlements_email ON pending_entitlements(email);
CREATE INDEX IF NOT EXISTS idx_pending_entitlements_status ON pending_entitlements(status);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_checkout_session_id ON orders(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own billing transactions" ON billing_transactions;
CREATE POLICY "Users can read own billing transactions"
  ON billing_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own billing subscriptions" ON billing_subscriptions;
CREATE POLICY "Users can read own billing subscriptions"
  ON billing_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can read billing data" ON billing_transactions;
CREATE POLICY "Staff can read billing data"
  ON billing_transactions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_staff = true OR is_manager = true))
  );

DROP POLICY IF EXISTS "Staff can read billing subscriptions" ON billing_subscriptions;
CREATE POLICY "Staff can read billing subscriptions"
  ON billing_subscriptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_staff = true OR is_manager = true))
  );
