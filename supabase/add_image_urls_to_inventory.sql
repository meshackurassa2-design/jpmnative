-- Add image_urls column to shop_inventory table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.shop_inventory
  ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';
