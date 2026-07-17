-- Function to securely increment the view count of a post.
-- We use SECURITY DEFINER so that authenticated users can increment the view count
-- even if they do not have update permissions on the post itself.

CREATE OR REPLACE FUNCTION increment_engaged_view(p_post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
