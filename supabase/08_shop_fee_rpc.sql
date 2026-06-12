-- Secure RPC to create a shop and atomically deduct 2000 coins from the user's wallet
CREATE OR REPLACE FUNCTION create_shop_with_fee(
  p_user_id UUID, 
  p_name VARCHAR, 
  p_description TEXT, 
  p_category VARCHAR, 
  p_location_city VARCHAR, 
  p_tra_tin VARCHAR
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance INTEGER;
    v_shop_fee INTEGER := 2000;
    v_shop_id UUID;
BEGIN
    -- Check balance and lock the profile row to prevent race conditions
    SELECT COALESCE(wallet_balance, 0) INTO v_balance
    FROM profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_balance < v_shop_fee THEN
        RAISE EXCEPTION 'Insufficient balance. You need % coins to open a shop.', v_shop_fee;
    END IF;

    -- Check if user already has a shop to prevent double charging
    IF EXISTS (SELECT 1 FROM shops WHERE owner_id = p_user_id) THEN
        RAISE EXCEPTION 'You already have a registered shop.';
    END IF;

    -- Deduct the fee
    UPDATE profiles
    SET wallet_balance = wallet_balance - v_shop_fee
    WHERE id = p_user_id;

    -- Insert the shop
    INSERT INTO shops (owner_id, name, description, category, location_city, tra_tin, status, is_paid)
    VALUES (p_user_id, p_name, p_description, p_category, p_location_city, p_tra_tin, 'pending', true)
    RETURNING id INTO v_shop_id;

    RETURN json_build_object('success', true, 'shop_id', v_shop_id);
END;
$$;
