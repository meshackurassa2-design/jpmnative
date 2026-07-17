-- Offers Migration

-- Add offer columns to messages table
ALTER TABLE public.messages ADD COLUMN is_offer BOOLEAN DEFAULT FALSE;
ALTER TABLE public.messages ADD COLUMN offer_amount NUMERIC;
ALTER TABLE public.messages ADD COLUMN offer_status TEXT; -- 'pending', 'accepted', 'declined'
ALTER TABLE public.messages ADD COLUMN offer_product_id UUID REFERENCES public.products(id);
