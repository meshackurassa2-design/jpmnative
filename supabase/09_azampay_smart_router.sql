-- Add transaction_type and metadata to azampay_transactions table
ALTER TABLE public.azampay_transactions 
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50) DEFAULT 'BUY_COINS' NOT NULL,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
