-- 1. Add trusted seller flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_trusted_seller boolean DEFAULT false;

-- Add an index for faster querying since we will check this flag often in the feed
CREATE INDEX IF NOT EXISTS idx_profiles_trusted_seller ON public.profiles(is_trusted_seller);
