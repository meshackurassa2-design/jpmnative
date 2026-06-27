-- Add missing columns to order_items table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0.05;

ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PROCESSING';
