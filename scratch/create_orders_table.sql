-- Run this in your Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(12, 2) NOT NULL,
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
  provider TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  city TEXT,
  azampay_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = buyer_id);

-- Only service role can insert/update (done via Edge Function)
-- No insert policy needed for users since Edge Function uses service role key
