CREATE TABLE IF NOT EXISTS public.azampay_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    amount INTEGER NOT NULL,
    currency VARCHAR(10) DEFAULT 'TZS',
    provider VARCHAR(50) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    external_id VARCHAR(100) UNIQUE NOT NULL,
    reference_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.azampay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" 
    ON public.azampay_transactions FOR SELECT 
    USING (auth.uid() = user_id);

-- Insert policy for edge functions (service role) or users 
-- Since edge functions use service_role key, they bypass RLS, 
-- but users should only be able to insert for themselves
CREATE POLICY "Users can insert their own transactions" 
    ON public.azampay_transactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Add to publication for realtime updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.azampay_transactions;
