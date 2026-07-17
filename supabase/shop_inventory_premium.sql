-- Add premium features columns to shop_inventory table
ALTER TABLE public.shop_inventory ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN DEFAULT false;
ALTER TABLE public.shop_inventory ADD COLUMN IF NOT EXISTS is_mystery_box BOOLEAN DEFAULT false;
