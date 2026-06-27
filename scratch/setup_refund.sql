CREATE OR REPLACE FUNCTION refund_studio_coins(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add the coins back
  UPDATE profiles
  SET wallet_balance = wallet_balance + 5000
  WHERE id = p_user_id;

  RETURN true;
END;
$$;
