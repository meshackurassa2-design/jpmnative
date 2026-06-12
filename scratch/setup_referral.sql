-- Referral System SQL Migration

-- 1. Add referral columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by text;

-- 2. Auto-generate a referral code for every existing user
UPDATE public.profiles 
SET referral_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

-- 3. Function to process a referral (call when a new user signs up with a referral code)
DROP FUNCTION IF EXISTS process_referral(text, uuid);

CREATE OR REPLACE FUNCTION process_referral(p_referral_code text, p_new_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referrer_id uuid;
  v_result jsonb;
BEGIN
  -- Find the referrer
  SELECT id INTO v_referrer_id 
  FROM public.profiles 
  WHERE referral_code = UPPER(p_referral_code) AND id != p_new_user_id;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  -- Check if new user already used a referral code
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_new_user_id AND referred_by IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Referral already applied');
  END IF;

  -- Mark the new user as referred
  UPDATE public.profiles SET referred_by = p_referral_code WHERE id = p_new_user_id;

  -- Reward both users 100 tokens each
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + 100 WHERE id = p_new_user_id;
  UPDATE public.profiles SET wallet_balance = COALESCE(wallet_balance, 0) + 100 WHERE id = v_referrer_id;

  RETURN jsonb_build_object('success', true, 'reward', 100);
END;
$$;

-- 4. Generate referral codes for any users who still don't have one (run periodically or as a trigger)
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON public.profiles;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();
