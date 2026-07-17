-- Shop Messages Migration

-- Add is_shop_chat column to messages table
ALTER TABLE public.messages ADD COLUMN is_shop_chat BOOLEAN DEFAULT FALSE;
