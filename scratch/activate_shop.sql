-- Activate your shop so products appear in the marketplace
-- Run this in Supabase SQL Editor

UPDATE public.shops
SET status = 'active'
WHERE owner_id = auth.uid();

-- Verify the result
SELECT id, name, status FROM public.shops WHERE owner_id = auth.uid();
