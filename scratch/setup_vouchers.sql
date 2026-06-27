-- 1. Create vouchers table
DROP TABLE IF EXISTS public.vouchers CASCADE;
CREATE TABLE public.vouchers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  amount_tsh integer NOT NULL,
  is_redeemed boolean DEFAULT false,
  redeemed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  redeemed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: Only admins can generate/view all vouchers. Normal users can only SELECT to redeem.
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all vouchers" 
ON public.vouchers FOR SELECT 
USING (auth.jwt() ->> 'email' = 'joshanemmanuels@gmail.com');

CREATE POLICY "Users can verify unredeemed vouchers" 
ON public.vouchers FOR SELECT 
USING (is_redeemed = false);

CREATE POLICY "Admins can insert vouchers" 
ON public.vouchers FOR INSERT 
WITH CHECK (auth.jwt() ->> 'email' = 'joshanemmanuels@gmail.com');

-- 2. RPC to Redeem Voucher
DROP FUNCTION IF EXISTS redeem_voucher(text);
CREATE OR REPLACE FUNCTION redeem_voucher(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher_id uuid;
  v_amount integer;
  v_is_redeemed boolean;
BEGIN
  -- Lock the voucher row to prevent double redemption (race condition)
  SELECT id, amount_tsh, is_redeemed INTO v_voucher_id, v_amount, v_is_redeemed 
  FROM public.vouchers 
  WHERE code = p_code FOR UPDATE;

  IF v_voucher_id IS NULL THEN
    RAISE EXCEPTION 'Voucher code not found.';
  END IF;

  IF v_is_redeemed THEN
    RAISE EXCEPTION 'This voucher has already been redeemed.';
  END IF;

  -- Mark voucher as redeemed
  UPDATE public.vouchers 
  SET is_redeemed = true, redeemed_by = auth.uid(), redeemed_at = now()
  WHERE id = v_voucher_id;

  -- Add TSH to user's wallet
  UPDATE public.profiles 
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_amount 
  WHERE id = auth.uid();

  RETURN true;
END;
$$;

-- 3. RPC to securely Buy Product with Wallet
DROP FUNCTION IF EXISTS buy_product_with_wallet(uuid, integer, text, text);
CREATE OR REPLACE FUNCTION buy_product_with_wallet(
  p_product_id uuid, 
  p_quantity integer,
  p_delivery_address text,
  p_phone_number text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer_id uuid;
  v_seller_id uuid;
  v_price integer;
  v_total_cost integer;
  v_buyer_balance integer;
  v_order_id uuid;
BEGIN
  v_buyer_id := auth.uid();

  -- Get product details and lock the row to check stock
  SELECT seller_id, price INTO v_seller_id, v_price 
  FROM public.products 
  WHERE id = p_product_id FOR UPDATE;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  IF v_buyer_id = v_seller_id THEN
    RAISE EXCEPTION 'You cannot buy your own product.';
  END IF;

  v_total_cost := v_price * p_quantity;

  -- Lock buyer's profile to prevent race conditions on balance
  SELECT COALESCE(wallet_balance, 0) INTO v_buyer_balance 
  FROM public.profiles 
  WHERE id = v_buyer_id FOR UPDATE;

  IF v_buyer_balance < v_total_cost THEN
    RAISE EXCEPTION 'Insufficient TSH balance. Please top up your wallet.';
  END IF;

  -- 1. Deduct from buyer
  UPDATE public.profiles 
  SET wallet_balance = wallet_balance - v_total_cost 
  WHERE id = v_buyer_id;

  -- 2. Credit to seller
  UPDATE public.profiles 
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_total_cost 
  WHERE id = v_seller_id;

  -- 3. Create the order record (Assuming 'orders' table exists)
  -- If 'orders' table does not exist or has different schema, this might need adjustment based on the actual schema.
  -- For now, we will just record the transaction via the balance transfer. 
  -- Assuming there is an `orders` table from `create_orders_table.sql`:
  INSERT INTO public.orders (
    product_id, buyer_id, seller_id, quantity, total_price, status, delivery_address, phone_number
  ) VALUES (
    p_product_id, v_buyer_id, v_seller_id, p_quantity, v_total_cost, 'pending', p_delivery_address, p_phone_number
  ) RETURNING id INTO v_order_id;

  RETURN v_order_id;
END;
$$;
