-- Create the vouchers table
CREATE TABLE vouchers (
    code VARCHAR(20) PRIMARY KEY,
    coin_value INTEGER NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

-- Secure RPC function to redeem a voucher atomically
CREATE OR REPLACE FUNCTION redeem_voucher(p_user_id UUID, p_code VARCHAR)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_coin_value INTEGER;
    v_is_used BOOLEAN;
BEGIN
    -- Lock the row for update to prevent race conditions (double spending)
    SELECT coin_value, is_used 
    INTO v_coin_value, v_is_used
    FROM vouchers 
    WHERE code = p_code 
    FOR UPDATE;

    -- Check if voucher exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid voucher code.';
    END IF;

    -- Check if already used
    IF v_is_used THEN
        RAISE EXCEPTION 'This voucher has already been used.';
    END IF;

    -- Mark as used
    UPDATE vouchers 
    SET is_used = true, 
        used_by = p_user_id, 
        used_at = timezone('utc'::text, now())
    WHERE code = p_code;

    -- Credit the user's wallet
    UPDATE profiles
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_coin_value
    WHERE id = p_user_id;

    RETURN v_coin_value;
END;
$$;


-- Admin helper function to easily generate batches of vouchers
CREATE OR REPLACE FUNCTION generate_vouchers(p_value INTEGER, p_count INTEGER)
RETURNS TABLE(generated_code VARCHAR, value INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    i INT;
    random_code VARCHAR(20);
BEGIN
    FOR i IN 1..p_count LOOP
        -- Generate format like: 2500-COIN-X8Y9Z0
        random_code := p_value::text || '-COIN-' || upper(substring(md5(random()::text) from 1 for 6));
        
        INSERT INTO vouchers (code, coin_value) 
        VALUES (random_code, p_value)
        ON CONFLICT (code) DO NOTHING;
        
        generated_code := random_code;
        value := p_value;
        RETURN NEXT;
    END LOOP;
END;
$$;
