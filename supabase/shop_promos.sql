-- supabase/shop_promos.sql

-- 1. Create the Promo Codes table
CREATE TABLE IF NOT EXISTS public.shop_promos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(shop_id, code)
);

-- RLS Policies for shop_promos
ALTER TABLE public.shop_promos ENABLE ROW LEVEL SECURITY;

-- Shop owners can manage their own promos
CREATE POLICY "Shop owners can manage their promos" ON public.shop_promos
    FOR ALL
    USING (auth.uid() = shop_id)
    WITH CHECK (auth.uid() = shop_id);

-- Anyone can read active promos to validate them
CREATE POLICY "Anyone can read active promos" ON public.shop_promos
    FOR SELECT
    USING (is_active = true);

-- 2. Alter order_items to support delivery tracking
-- (Assuming order_items table already exists based on store-dashboard.tsx)
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS driver_lat DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS driver_lng DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS promo_code TEXT,
ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION DEFAULT 0;

-- Optional: Enable realtime for order_items if not already enabled
-- This is necessary for the tracking feature to update the map in real-time
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
