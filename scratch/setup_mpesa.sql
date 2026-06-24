CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    phone_number TEXT NOT NULL,
    transaction_reference TEXT UNIQUE, -- M-Pesa's receipt number
    conversation_id TEXT UNIQUE, -- M-Pesa's session/conversation ID to link callbacks
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mpesa transactions" ON public.mpesa_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own mpesa transactions" ON public.mpesa_transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    
-- Allow service role (Edge Function) to update transactions
CREATE POLICY "Service role can update transactions" ON public.mpesa_transactions
    FOR UPDATE USING (true);
