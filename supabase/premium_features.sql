-- Premium Features Migration: Wallets, Payouts, and Wishlists

-- 1. Create Wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    balance DOUBLE PRECISION DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(shop_id)
);

-- Enable RLS for Wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own shop's wallet" 
    ON public.wallets FOR SELECT 
    USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update their own shop's wallet" 
    ON public.wallets FOR UPDATE 
    USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

-- 2. Create Payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    provider TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own shop's payouts" 
    ON public.payouts FOR SELECT 
    USING (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

CREATE POLICY "Users can insert payouts for their shop" 
    ON public.payouts FOR INSERT 
    WITH CHECK (shop_id IN (SELECT id FROM public.shops WHERE owner_id = auth.uid()));

-- 3. Create Wishlists table
CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, product_id)
);

-- Enable RLS for Wishlists
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own wishlist" 
    ON public.wishlists FOR ALL 
    USING (auth.uid() = user_id);

-- Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.payouts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlists;
