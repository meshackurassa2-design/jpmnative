-- SQL Script for Casino Spin Feature

-- RPC to securely play the Casino Spin
DROP FUNCTION IF EXISTS play_casino_spin(uuid, integer);

CREATE OR REPLACE FUNCTION play_casino_spin(p_user_id uuid, p_bet integer DEFAULT 30)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance integer;
  v_rand numeric;
  v_payout integer;
BEGIN
  -- Lock row to prevent race conditions (e.g. clicking very fast to bypass balance checks)
  SELECT wallet_balance INTO v_balance FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  
  -- 1. Check if user has enough coins
  IF v_balance < p_bet THEN
    RAISE EXCEPTION 'Insufficient balance to play.';
  END IF;

  -- 2. Deduct the bet immediately
  UPDATE public.profiles SET wallet_balance = wallet_balance - p_bet WHERE id = p_user_id;

  -- 3. Roll the dice
  v_rand := random();
  
  -- Odds Logic (Tough Mode)
  IF v_rand < 0.75 THEN
    -- 75% chance: Lose all 30 coins
    v_payout := 0;
  ELSIF v_rand < 0.90 THEN
    -- 15% chance: Small win (15 coins back)
    v_payout := 15;
  ELSIF v_rand < 0.98 THEN
    -- 8% chance: Double up (60 coins)
    v_payout := 60;
  ELSIF v_rand < 0.995 THEN
    -- 1.5% chance: Jackpot (300 coins)
    v_payout := 300;
  ELSE
    -- 0.5% chance: Mega Jackpot (1500 coins)
    v_payout := 1500;
  END IF;

  -- 4. Add the payout (if any)
  IF v_payout > 0 THEN
    UPDATE public.profiles SET wallet_balance = wallet_balance + v_payout WHERE id = p_user_id;
  END IF;

  -- Return the payout amount so the UI can animate it
  RETURN v_payout;
END;
$$;
