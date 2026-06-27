-- Fix the missing ID default in the orders table
-- Run this in your Supabase SQL Editor

ALTER TABLE public.orders 
ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.order_items 
ALTER COLUMN id SET DEFAULT gen_random_uuid();
