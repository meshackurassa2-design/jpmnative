-- 1. Add the has_ai_brain column to the profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_ai_brain BOOLEAN DEFAULT false;

-- 2. Create the RPC function to unlock the AI Brain
-- This securely deducts 10,000 coins and flips the has_ai_brain boolean to true.
CREATE OR REPLACE FUNCTION unlock_ai_brain(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INT;
  unlock_cost INT := 10000;
BEGIN
  -- Get the user's current wallet balance
  SELECT wallet_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id;

  -- Check if they have enough coins
  IF current_balance IS NULL OR current_balance < unlock_cost THEN
    RAISE EXCEPTION 'Insufficient coins. You need 10,000 coins to unlock the AI Brain.';
  END IF;

  -- Check if they already have it unlocked
  IF (SELECT has_ai_brain FROM profiles WHERE id = p_user_id) = true THEN
    RAISE EXCEPTION 'AI Brain is already unlocked for this account.';
  END IF;

  -- Deduct the coins and unlock the feature in a single transaction
  UPDATE profiles
  SET 
    wallet_balance = wallet_balance - unlock_cost,
    has_ai_brain = true
  WHERE id = p_user_id;

  -- Log the transaction in the economy ledger (if you have one)
  -- For now, just returning true means success
  RETURN true;
END;
$$;
