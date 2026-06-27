-- 1. Create the video_generations table
CREATE TABLE IF NOT EXISTS video_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    language VARCHAR(50) DEFAULT 'en',
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    video_url TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for fast user history lookup
CREATE INDEX IF NOT EXISTS idx_video_generations_user ON video_generations(user_id);

-- 2. Create the RPC function to charge for the video creation
CREATE OR REPLACE FUNCTION spend_studio_coins(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance INT;
  video_cost INT := 5000;
BEGIN
  -- Get the user's current wallet balance
  SELECT wallet_balance INTO current_balance
  FROM profiles
  WHERE id = p_user_id;

  -- Check if they have enough coins
  IF current_balance IS NULL OR current_balance < video_cost THEN
    RAISE EXCEPTION 'Insufficient coins. You need 5,000 coins to generate a video.';
  END IF;

  -- Deduct the coins
  UPDATE profiles
  SET wallet_balance = wallet_balance - video_cost
  WHERE id = p_user_id;

  RETURN true;
END;
$$;
