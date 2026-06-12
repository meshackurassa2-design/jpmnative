-- SQL Script to Set Up Rewarded Ads Wallet & Withdrawals

-- 1. Add wallet balance to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_balance integer DEFAULT 0;

-- 2. Create withdrawals table
DROP TABLE IF EXISTS public.withdrawals CASCADE;
CREATE TABLE public.withdrawals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  payment_email text NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on withdrawals
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own withdrawals"
ON public.withdrawals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own withdrawals"
ON public.withdrawals FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. RPC to securely spend coins
DROP FUNCTION IF EXISTS spend_coins(uuid, integer);

CREATE OR REPLACE FUNCTION spend_coins(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Lock row to prevent race conditions
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Deduct
  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_user_id;
END;
$$;

-- 4. RPC to securely grant rewarded ad coins via Mystery Box Algorithm
DROP FUNCTION IF EXISTS grant_ad_reward(uuid);
DROP FUNCTION IF EXISTS grant_ad_reward(uuid, integer);

CREATE OR REPLACE FUNCTION grant_ad_reward(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rand numeric;
  v_reward integer;
BEGIN
  v_rand := random();
  
  IF v_rand < 0.70 THEN
    v_reward := 10;       -- 70% chance: standard reward
  ELSIF v_rand < 0.90 THEN
    v_reward := 20;       -- 20% chance: bonus reward
  ELSE
    v_reward := 50;       -- 10% chance: max reward (enough for 1 image!)
  END IF;

  -- Add to the balance
  UPDATE public.profiles 
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_reward 
  WHERE id = p_user_id;

  RETURN v_reward;
END;
$$;

-- 5. RPC to securely request withdrawal
CREATE OR REPLACE FUNCTION request_withdrawal(p_user_id uuid, p_amount integer, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
BEGIN
  -- Lock row
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  
  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance to withdraw';
  END IF;

  -- Deduct
  UPDATE public.profiles SET wallet_balance = wallet_balance - p_amount WHERE id = p_user_id;
  
  -- Record
  INSERT INTO public.withdrawals (user_id, amount, payment_email, status)
  VALUES (p_user_id, p_amount, p_email, 'pending');
END;
$$;