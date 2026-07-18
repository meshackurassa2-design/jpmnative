-- Migration: Create tables for detailed post-level analytics

CREATE TABLE IF NOT EXISTS post_analytics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    views INT DEFAULT 0,
    UNIQUE(post_id, date)
);

CREATE TABLE IF NOT EXISTS video_retention (
    post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
    views_start INT DEFAULT 0,
    views_25 INT DEFAULT 0,
    views_50 INT DEFAULT 0,
    views_75 INT DEFAULT 0,
    views_100 INT DEFAULT 0
);

-- RPC to log daily post views
CREATE OR REPLACE FUNCTION log_post_view(p_post_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS void AS $$
BEGIN
  -- Increment global view count
  UPDATE posts
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_post_id;

  -- Upsert daily view count
  INSERT INTO post_analytics_daily (post_id, date, views)
  VALUES (p_post_id, p_date, 1)
  ON CONFLICT (post_id, date)
  DO UPDATE SET views = post_analytics_daily.views + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to log video retention milestones
CREATE OR REPLACE FUNCTION log_video_retention(p_post_id UUID, p_milestone INT)
RETURNS void AS $$
BEGIN
  -- Ensure row exists
  INSERT INTO video_retention (post_id) VALUES (p_post_id) ON CONFLICT DO NOTHING;

  IF p_milestone = 0 THEN
      UPDATE video_retention SET views_start = views_start + 1 WHERE post_id = p_post_id;
  ELSIF p_milestone = 25 THEN
      UPDATE video_retention SET views_25 = views_25 + 1 WHERE post_id = p_post_id;
  ELSIF p_milestone = 50 THEN
      UPDATE video_retention SET views_50 = views_50 + 1 WHERE post_id = p_post_id;
  ELSIF p_milestone = 75 THEN
      UPDATE video_retention SET views_75 = views_75 + 1 WHERE post_id = p_post_id;
  ELSIF p_milestone = 100 THEN
      UPDATE video_retention SET views_100 = views_100 + 1 WHERE post_id = p_post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
