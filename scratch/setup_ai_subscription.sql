-- 1. Add the subscription expiry date to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS ai_subscription_ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Create the RPC function to buy/renew the AI Subscription
-- This securely deducts 25,000 coins and adds 30 days to the subscription.
CREATE OR REPLACE FUNCTION buy_ai_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INT;
  sub_cost INT := 25000;
  current_expiry TIMESTAMP WITH TIME ZONE;
  new_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the user's current wallet balance and expiry
  SELECT wallet_balance, ai_subscription_ends_at 
  INTO current_balance, current_expiry
  FROM profiles
  WHERE id = p_user_id;

  -- Check if they have enough coins
  IF current_balance IS NULL OR current_balance < sub_cost THEN
    RAISE EXCEPTION 'Insufficient coins. You need 25,000 coins for a 30-day AI Pro subscription.';
  END IF;

  -- Calculate new expiry (If already active, add 30 days to current expiry. If expired/null, add 30 days from NOW)
  IF current_expiry IS NOT NULL AND current_expiry > NOW() THEN
    new_expiry := current_expiry + INTERVAL '30 days';
  ELSE
    new_expiry := NOW() + INTERVAL '30 days';
  END IF;

  -- Deduct the coins and update the expiry in a single transaction
  UPDATE profiles
  SET 
    wallet_balance = wallet_balance - sub_cost,
    ai_subscription_ends_at = new_expiry
  WHERE id = p_user_id;

  RETURN true;
END;
$$;
