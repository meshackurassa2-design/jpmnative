-- Run this script in your Supabase SQL Editor to enable Admin Notifications!

-- 1. Trigger for Profiles (Verification Approved & Monetization Approved)
CREATE OR REPLACE FUNCTION notify_profile_admin_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if Verification was just approved
  IF NEW.is_verified = true AND OLD.is_verified = false THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (NEW.id, NEW.id, 'verification_approved');
  END IF;

  -- Check if Monetization was just approved
  IF (NEW.settings->>'creator_application_status') = 'approved' AND 
     (OLD.settings->>'creator_application_status' IS NULL OR OLD.settings->>'creator_application_status' != 'approved') THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (NEW.id, NEW.id, 'monetization_approved');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_admin_change ON public.profiles;
CREATE TRIGGER on_profile_admin_change
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION notify_profile_admin_changes();


-- 2. Trigger for Verification Requests (Verification Denied)
CREATE OR REPLACE FUNCTION notify_verification_denied()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the request was just rejected
  IF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (NEW.user_id, NEW.user_id, 'verification_denied');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_verification_reject ON public.verification_requests;
CREATE TRIGGER on_verification_reject
AFTER UPDATE ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION notify_verification_denied();
