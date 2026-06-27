-- Run this entire script in your Supabase SQL Editor to fix the checkout error

-- 1. Create the secure checkout function
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

    -- 5. Process Each Item (Transfer funds and create order_items)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_seller_id := (v_item->>'sellerId')::UUID;
        v_item_total := ((v_item->>'price')::NUMERIC * (v_item->>'quantity')::NUMERIC)::INTEGER;
        v_commission := (v_item->>'commission')::NUMERIC;
        
        -- Insert Order Item
        INSERT INTO public.order_items (
            order_id, shop_id, product_id, product_name, price, quantity, status
        ) VALUES (
            v_order_id, v_seller_id, (v_item->>'productId')::UUID, v_item->>'name', (v_item->>'price')::NUMERIC, (v_item->>'quantity')::INTEGER, 'PENDING'
        );

        -- Add to Seller Wallet (Minus Commission)
        UPDATE public.profiles
        SET wallet_balance = wallet_balance + (v_item_total * (1 - v_commission))
        WHERE id = v_seller_id;
    END LOOP;

    RETURN v_order_id;
END;
$$;

-- 2. Force Supabase API to reload the schema cache so the app can see the new function
NOTIFY pgrst, 'reload schema';
