CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete the user from auth.users.
  -- This will cascade and delete the user's profile and other data if ON DELETE CASCADE is set.
  -- SECURITY DEFINER allows the function to bypass RLS and delete from the restricted auth schema,
  -- but we restrict it to ONLY delete the currently authenticated user (auth.uid()).
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
