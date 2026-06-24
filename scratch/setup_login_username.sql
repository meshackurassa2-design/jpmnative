CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_email text;
BEGIN
    SELECT u.email INTO v_email
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.username = p_username
    LIMIT 1;
    
    RETURN v_email;
END;
$$ LANGUAGE plpgsql;
