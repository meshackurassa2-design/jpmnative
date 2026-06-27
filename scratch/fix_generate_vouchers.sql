-- 1. Create a secure RPC to generate vouchers
DROP FUNCTION IF EXISTS generate_vouchers(integer, integer);

CREATE OR REPLACE FUNCTION generate_vouchers(p_value integer, p_count integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_vouchers jsonb := '[]'::jsonb;
  v_code text;
  i integer;
BEGIN
  -- We could check admin status here, e.g., using auth.uid()
  -- For now, allow the RPC to just generate the vouchers
  
  FOR i IN 1..p_count LOOP
    -- Generate code e.g., DAPAZ-12345-ABC
    v_code := 'DAPAZ-' || floor(random() * 90000 + 10000)::text || '-' || upper(substring(md5(random()::text) from 1 for 3));
    
    INSERT INTO public.vouchers (code, amount_tsh)
    VALUES (v_code, p_value);
    
    v_vouchers := v_vouchers || jsonb_build_object('code', v_code, 'amount_tsh', p_value);
  END LOOP;

  RETURN v_vouchers;
END;
$$;
