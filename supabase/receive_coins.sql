-- receive_coins function: credits coins to a user's wallet
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION receive_coins(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET wallet_balance = COALESCE(wallet_balance, 0) + p_amount
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
