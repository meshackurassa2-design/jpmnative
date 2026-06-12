-- scratch/setup_ai.sql
-- RPC function to securely deduct coins for AI usage

DROP FUNCTION IF EXISTS spend_coins(uuid, integer);

CREATE OR REPLACE FUNCTION spend_coins(p_user_id uuid, p_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Lock the row to prevent double-spending race conditions
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  
  -- Ensure they have enough coins
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient coins. Please buy more to continue.';
  END IF;

  -- Deduct the coins
  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_user_id;

  RETURN true;
END;
$$;
