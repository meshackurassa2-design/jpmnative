-- E-commerce Core Tables & RPCs

-- 1. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES public.profiles(id),
    buyer_name TEXT,
    buyer_email TEXT,
    buyer_phone TEXT,
    buyer_address TEXT,
    buyer_city TEXT,
    total_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'PAID',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.profiles(id), -- The seller's ID
    product_id UUID,
    product_name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    commission_rate NUMERIC DEFAULT 0.05, -- 5% platform fee
    status TEXT DEFAULT 'PROCESSING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Buyer can view their own orders
CREATE POLICY "Buyers can view their own orders" ON public.orders
    FOR SELECT USING (auth.uid() = buyer_id);

-- Sellers can view order items belonging to their shop
CREATE POLICY "Sellers can view their order items" ON public.order_items
    FOR SELECT USING (auth.uid() = shop_id);

-- Buyers can view order items for their orders
CREATE POLICY "Buyers can view items in their orders" ON public.order_items
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE buyer_id = auth.uid())
    );

-- Sellers can update order item status (e.g., mark as SHIPPED)
CREATE POLICY "Sellers can update their order items" ON public.order_items
    FOR UPDATE USING (auth.uid() = shop_id);

-- 3. Secure Transaction RPC for Checkout
DROP FUNCTION IF EXISTS process_checkout;

CREATE OR REPLACE FUNCTION process_checkout(
    p_buyer_id UUID,
    p_buyer_name TEXT,
    p_buyer_email TEXT,
    p_buyer_phone TEXT,
    p_buyer_address TEXT,
    p_buyer_city TEXT,
    p_total_amount INTEGER,
    p_items JSONB -- Array of { sellerId, productId, name, price, quantity, commission }
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_buyer_balance INTEGER;
    v_order_id UUID;
    v_item JSONB;
    v_seller_id UUID;
    v_item_total INTEGER;
    v_commission NUMERIC;
BEGIN
    -- 1. Lock buyer's row to prevent race conditions
    SELECT wallet_balance INTO v_buyer_balance 
    FROM public.profiles 
    WHERE id = p_buyer_id 
    FOR UPDATE;

    -- 2. Verify balance
    IF v_buyer_balance < p_total_amount THEN
        RAISE EXCEPTION 'Insufficient balance. You need % but have %', p_total_amount, v_buyer_balance;
    END IF;

    -- 3. Deduct from buyer
    UPDATE public.profiles 
    SET wallet_balance = wallet_balance - p_total_amount 
    WHERE id = p_buyer_id;

    -- 4. Create Order
    INSERT INTO public.orders (
        buyer_id, buyer_name, buyer_email, buyer_phone, buyer_address, buyer_city, total_amount, status
    ) VALUES (
        p_buyer_id, p_buyer_name, p_buyer_email, p_buyer_phone, p_buyer_address, p_buyer_city, p_total_amount, 'PAID'
    ) RETURNING id INTO v_order_id;

    -- 5. Loop through items, insert into order_items, and pay sellers
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_seller_id := (v_item->>'sellerId')::UUID;
        v_item_total := ((v_item->>'price')::INTEGER) * ((v_item->>'quantity')::INTEGER);
        v_commission := COALESCE((v_item->>'commission')::NUMERIC, 0.05);

        -- Insert order item
        INSERT INTO public.order_items (
            order_id, shop_id, product_id, product_name, price, quantity, commission_rate, status
        ) VALUES (
            v_order_id, 
            v_seller_id, 
            (v_item->>'productId')::UUID, 
            v_item->>'name', 
            (v_item->>'price')::INTEGER, 
            (v_item->>'quantity')::INTEGER, 
            v_commission,
            'PROCESSING'
        );

        -- Pay the seller (only the price amount, ignoring delivery fee which isn't currently tracked per-seller in simple logic, or if we subtract commission)
        -- The dashboard calculates net earnings dynamically (price - commission). So we give them the full price and deduct withdrawal fees later, or we credit them (price - commission).
        -- For now, credit the full item total to their wallet.
        IF v_seller_id IS NOT NULL AND v_item_total > 0 THEN
            UPDATE public.profiles 
            SET wallet_balance = COALESCE(wallet_balance, 0) + v_item_total 
            WHERE id = v_seller_id;
        END IF;
    END LOOP;

    RETURN v_order_id;
END;
$$;
