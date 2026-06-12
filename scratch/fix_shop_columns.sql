-- Run this in your Supabase SQL Editor to add the missing columns

ALTER TABLE public.shops
ADD COLUMN IF NOT EXISTS cover_image TEXT,
ADD COLUMN IF NOT EXISTS avatar_image TEXT;
