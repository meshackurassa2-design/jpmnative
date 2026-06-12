-- Run this script in your Supabase SQL Editor to enable automatic notifications!

-- NOTE: The notifications table and policies already exist in your database.
-- This script will just create the triggers to automatically populate the table.

-- 1. Trigger for Likes
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER AS $$
DECLARE
  post_creator uuid;
BEGIN
  -- Get the creator of the post
  SELECT creator_id INTO post_creator FROM public.posts WHERE id = NEW.post_id;
  
  -- Don't notify if liking own post
  IF post_creator != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (post_creator, NEW.user_id, 'like', NEW.post_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_post_like ON public.likes;
CREATE TRIGGER on_post_like
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION notify_post_like();

-- 2. Trigger for Comments
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_creator uuid;
BEGIN
  SELECT creator_id INTO post_creator FROM public.posts WHERE id = NEW.post_id;
  
  IF post_creator != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id, comment_id)
    VALUES (post_creator, NEW.user_id, 'comment', NEW.post_id, NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_post_comment ON public.comments;
CREATE TRIGGER on_post_comment
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION notify_post_comment();

-- 3. Trigger for Follows
CREATE OR REPLACE FUNCTION notify_user_follow()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_follow ON public.follows;
CREATE TRIGGER on_user_follow
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION notify_user_follow();
