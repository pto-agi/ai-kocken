-- ============================================
-- PTO App – Payments v2 (Stripe + Webhooks)
-- Source-of-truth migration matching runtime code.
-- Run in Supabase SQL Editor for new environments.
-- Updated: 2026-04-04
-- ============================================

-- ── Stripe Customers ──
CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_user_id ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_email ON stripe_customers(email);

-- ── Stripe Transactions ──
CREATE TABLE IF NOT EXISTS stripe_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id UUID,
  email TEXT,
  flow TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  amount NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'SEK',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_subscription_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_transactions_user_id ON stripe_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_email ON stripe_transactions(email);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_flow ON stripe_transactions(flow);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_status ON stripe_transactions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_subscription_id ON stripe_transactions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transactions_payment_intent ON stripe_transactions(stripe_payment_intent_id);

-- ── Stripe Subscriptions ──
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_user_id ON stripe_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_email ON stripe_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status ON stripe_subscriptions(status);

-- ── Stripe Webhook Events ──
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status ON stripe_webhook_events(status);

-- ── Pending Entitlements ──
CREATE TABLE IF NOT EXISTS stripe_pending_entitlements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  entitlement_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_pending_entitlements_email ON stripe_pending_entitlements(email);
CREATE INDEX IF NOT EXISTS idx_stripe_pending_entitlements_status ON stripe_pending_entitlements(status);

-- ── Friskvård Orders ──
CREATE TABLE IF NOT EXISTS friskvard_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  flow TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_sek INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_friskvard_orders_email ON friskvard_orders(email);
CREATE INDEX IF NOT EXISTS idx_friskvard_orders_status ON friskvard_orders(status);

-- ── Orders table extensions ──
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_checkout_session_id ON orders(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- ── Row Level Security ──
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_pending_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE friskvard_orders ENABLE ROW LEVEL SECURITY;

-- Users can read own transactions
DROP POLICY IF EXISTS "Users can read own stripe transactions" ON stripe_transactions;
CREATE POLICY "Users can read own stripe transactions"
  ON stripe_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can read own subscriptions
DROP POLICY IF EXISTS "Users can read own stripe subscriptions" ON stripe_subscriptions;
CREATE POLICY "Users can read own stripe subscriptions"
  ON stripe_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Staff can read all billing data
DROP POLICY IF EXISTS "Staff can read stripe transactions" ON stripe_transactions;
CREATE POLICY "Staff can read stripe transactions"
  ON stripe_transactions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_staff = true OR is_manager = true))
  );

DROP POLICY IF EXISTS "Staff can read stripe subscriptions" ON stripe_subscriptions;
CREATE POLICY "Staff can read stripe subscriptions"
  ON stripe_subscriptions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_staff = true OR is_manager = true))
  );

-- Service role handles inserts/updates via admin client (bypasses RLS)
