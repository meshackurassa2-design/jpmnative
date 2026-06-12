-- Supabase Push Notification Trigger

-- 1. Create a function that calls the Expo Push API via pg_net (or http extension if enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  receiver_token text;
  sender_name text;
  payload jsonb;
BEGIN
  -- Get the receiver's push token
  SELECT push_token INTO receiver_token
  FROM public.profiles
  WHERE id = NEW.receiver_id;

  -- Get the sender's name
  SELECT username INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF receiver_token IS NOT NULL THEN
    -- Construct the Expo push notification payload
    payload := jsonb_build_object(
      'to', receiver_token,
      'title', 'New message from @' || COALESCE(sender_name, 'someone'),
      'body', 'You have received a new encrypted message.',
      'sound', 'default',
      'data', jsonb_build_object('type', 'message', 'sender_id', NEW.sender_id)
    );

    -- Send the request to Expo using pg_net
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := payload,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the messages table
DROP TRIGGER IF EXISTS trigger_notify_new_message ON public.messages;
CREATE TRIGGER trigger_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();
