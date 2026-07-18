-- 1. Notify on Post Like
CREATE OR REPLACE FUNCTION notify_post_liked()
RETURNS TRIGGER AS $$
DECLARE
  v_post_owner uuid;
BEGIN
  -- Get the owner of the post
  SELECT creator_id INTO v_post_owner FROM public.posts WHERE id = NEW.post_id;
  
  -- Don't notify if the user liked their own post
  IF v_post_owner != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (v_post_owner, NEW.user_id, 'like', NEW.post_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_post_liked ON public.likes;
CREATE TRIGGER trigger_post_liked
AFTER INSERT ON public.likes
FOR EACH ROW EXECUTE FUNCTION notify_post_liked();


-- 2. Notify on Post Comment
CREATE OR REPLACE FUNCTION notify_post_commented()
RETURNS TRIGGER AS $$
DECLARE
  v_post_owner uuid;
BEGIN
  -- Get the owner of the post
  SELECT creator_id INTO v_post_owner FROM public.posts WHERE id = NEW.post_id;
  
  -- Don't notify if the user commented on their own post
  IF v_post_owner != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (v_post_owner, NEW.user_id, 'comment', NEW.post_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_post_commented ON public.comments;
CREATE TRIGGER trigger_post_commented
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION notify_post_commented();


-- 3. Notify on User Follow
CREATE OR REPLACE FUNCTION notify_user_followed()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_user_followed ON public.follows;
CREATE TRIGGER trigger_user_followed
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION notify_user_followed();
