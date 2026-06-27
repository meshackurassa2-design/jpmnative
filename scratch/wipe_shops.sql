-- WIPE ALL SHOPS, PRODUCTS, AND PURCHASE HISTORY TO START FRESH
-- This will delete all shop-related data so you can test the new system from scratch.

-- 1. Delete all purchase history and orders
DELETE FROM public.order_items;
DELETE FROM public.orders;

-- 2. Delete all product reviews and wishlists
DELETE FROM public.product_reviews;
DELETE FROM public.wishlists;

-- 3. Finally, delete all shops (and the products inside them)
DELETE FROM public.shops;

-- Note: We are NOT deleting users or their wallet balances. 
-- Only the shop and product data is being wiped clean!
