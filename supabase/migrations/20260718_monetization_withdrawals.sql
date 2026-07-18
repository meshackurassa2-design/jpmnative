-- Add withdrawn_earnings to profiles to track how much of monetization_earnings has been paid out
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS withdrawn_earnings NUMERIC DEFAULT 0;

-- Function to safely request a withdrawal from monetization earnings
CREATE OR REPLACE FUNCTION request_monetization_withdrawal(
    p_amount_usd NUMERIC,
    p_payment_method TEXT,
    p_payment_details JSONB,
    p_exchange_rate NUMERIC DEFAULT 2600 -- Default conversion rate: 1 USD = 2600 TSH
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_monetization_earnings NUMERIC;
    v_withdrawn_earnings NUMERIC;
    v_available_balance NUMERIC;
    v_amount_tsh NUMERIC;
    v_transaction_id UUID;
BEGIN
    -- Get the authenticated user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Validate minimum withdrawal
    IF p_amount_usd < 50 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Minimum withdrawal is $50.');
    END IF;

    -- Get the user's earnings
    SELECT COALESCE(monetization_earnings, 0), COALESCE(withdrawn_earnings, 0)
    INTO v_monetization_earnings, v_withdrawn_earnings
    FROM public.profiles
    WHERE id = v_user_id;

    -- Calculate available balance
    v_available_balance := v_monetization_earnings - v_withdrawn_earnings;

    -- Check if they have enough balance
    IF v_available_balance < p_amount_usd THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient available balance.');
    END IF;

    -- Convert USD to TSH
    v_amount_tsh := p_amount_usd * p_exchange_rate;

    -- 1. Insert into wallet_transactions in TSH
    INSERT INTO public.wallet_transactions (
        profile_id,
        amount,
        type,
        status,
        description,
        metadata
    ) VALUES (
        v_user_id,
        v_amount_tsh,
        'WITHDRAWAL',
        'PENDING',
        p_payment_method || ' Payout (USD ' || p_amount_usd || ')',
        p_payment_details
    ) RETURNING id INTO v_transaction_id;

    -- 2. Update withdrawn_earnings in profiles
    UPDATE public.profiles
    SET withdrawn_earnings = COALESCE(withdrawn_earnings, 0) + p_amount_usd,
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Withdrawal of ' || v_amount_tsh || ' TSH requested successfully.',
        'transaction_id', v_transaction_id
    );
END;
$$;
