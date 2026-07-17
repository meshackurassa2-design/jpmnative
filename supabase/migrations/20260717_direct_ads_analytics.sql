-- Direct Ads Analytics & Engagement Tracking Migration
-- Adds impressions, clicks, and max_impressions tracking to direct_ads table with safe public RPC increments

ALTER TABLE public.direct_ads ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;
ALTER TABLE public.direct_ads ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0;
ALTER TABLE public.direct_ads ADD COLUMN IF NOT EXISTS max_impressions INTEGER DEFAULT 0;

-- Drop existing functions first to avoid parameter name conflict errors across different Postgres versions
DROP FUNCTION IF EXISTS public.increment_ad_impressions(UUID);
DROP FUNCTION IF EXISTS public.increment_ad_clicks(UUID);

-- Function to increment impressions securely from client without full table update permissions
-- Automatically stops incrementing once the ad hits its impression cap (if set > 0)
CREATE OR REPLACE FUNCTION public.increment_ad_impressions(ad_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.direct_ads
  SET impressions = COALESCE(impressions, 0) + 1
  WHERE direct_ads.id = increment_ad_impressions.ad_id
    AND (max_impressions IS NULL OR max_impressions <= 0 OR COALESCE(impressions, 0) < max_impressions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment clicks securely from client
CREATE OR REPLACE FUNCTION public.increment_ad_clicks(ad_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.direct_ads
  SET clicks = COALESCE(clicks, 0) + 1
  WHERE direct_ads.id = increment_ad_clicks.ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
