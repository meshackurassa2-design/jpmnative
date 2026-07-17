-- ── ClickPesa Payments Table ───────────────────────────────────────────────
-- Tracks every USSD-PUSH payment initiated through ClickPesa

CREATE TABLE IF NOT EXISTS public.clickpesa_payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_reference    TEXT NOT NULL UNIQUE,         -- ClickPesa unique order ref
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount             NUMERIC(12, 2) NOT NULL,       -- amount in TZS
  currency           TEXT NOT NULL DEFAULT 'TZS',
  phone_number       TEXT NOT NULL,                 -- e.g. 255712345678
  description        TEXT,
  status             TEXT NOT NULL DEFAULT 'PROCESSING',
  -- status values: PROCESSING | SUCCESS | SETTLED | FAILED | PENDING
  payment_reference  TEXT,                          -- ClickPesa internal ref
  collected_amount   NUMERIC(12, 2),
  channel            TEXT,                          -- e.g. TIGO-PESA, M-PESA
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_clickpesa_payments_user_id
  ON public.clickpesa_payments(user_id);

-- Index for status polling
CREATE INDEX IF NOT EXISTS idx_clickpesa_payments_order_ref
  ON public.clickpesa_payments(order_reference);

-- Row Level Security
ALTER TABLE public.clickpesa_payments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own payments
CREATE POLICY "Users can view own payments"
  ON public.clickpesa_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Only the service role (edge functions) can insert/update
CREATE POLICY "Service role can manage payments"
  ON public.clickpesa_payments FOR ALL
  USING (auth.role() = 'service_role');

-- ── Optional: credit_wallet RPC ─────────────────────────────────────────────
-- Adjust this to match your actual wallet table.
-- If you already have a credit RPC, you can skip this block.

-- CREATE OR REPLACE FUNCTION public.credit_wallet(p_user_id UUID, p_amount NUMERIC)
-- RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   UPDATE public.wallets
--   SET balance = balance + p_amount,
--       updated_at = NOW()
--   WHERE user_id = p_user_id;
-- END;
-- $$;
