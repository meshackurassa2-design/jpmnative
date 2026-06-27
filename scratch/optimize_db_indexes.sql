-- Supabase Database Optimization Script
-- This script adds indexes to heavily queried columns to speed up your database significantly.
-- It is 100% safe to run and will not delete or alter any data.

-- 1. Index for Marketplace (Speed up fetching active shops)
CREATE INDEX IF NOT EXISTS idx_shops_status ON public.shops(status);
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON public.shops(owner_id);

-- 2. Index for Products (Speed up searching and filtering products by shop)
CREATE INDEX IF NOT EXISTS idx_shop_inventory_shop_id ON public.shop_inventory(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_inventory_category ON public.shop_inventory(category);

-- 3. Index for Orders and Order Items (Speed up Analytics and Revenue calculation)
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_shop_id ON public.order_items(shop_id);

-- 4. Index for Wishlists
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_shop_id ON public.wishlists(shop_id);

-- 5. Index for Messaging/Chats
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(sender_id, receiver_id);

-- Reload schema cache just to be safe
NOTIFY pgrst, 'reload schema';
