CREATE OR REPLACE FUNCTION accept_collaboration(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts 
  SET settings = jsonb_set(settings, '{co_author_status}', '"accepted"')
  WHERE id = p_post_id AND settings->>'co_author_id' = auth.uid()::text;
END;
$$;
