-- Supabase Push Notification Trigger for Low Stock Alerts
-- Uses pg_net to call Expo Push API

CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
DECLARE
  shop_owner_id uuid;
  receiver_token text;
  shop_name text;
  payload jsonb;
BEGIN
  -- Only trigger if the quantity actually drops to or below min_stock
  -- and it wasn't already below min_stock before the update
  IF NEW.quantity <= NEW.min_stock AND (TG_OP = 'INSERT' OR OLD.quantity > OLD.min_stock) THEN
    
    -- Get shop owner and shop name
    SELECT owner_id, name INTO shop_owner_id, shop_name
    FROM public.shops
    WHERE id = NEW.shop_id;

    -- Get the owner's push token
    SELECT push_token INTO receiver_token
    FROM public.profiles
    WHERE id = shop_owner_id;

    IF receiver_token IS NOT NULL THEN
      -- Construct the Expo push notification payload
      payload := jsonb_build_object(
        'to', receiver_token,
        'title', 'Low Stock Alert 🔴',
        'body', 'Your item "' || NEW.name || '" in ' || shop_name || ' is running low (' || NEW.quantity || ' ' || NEW.unit || ' left).',
        'sound', 'default',
        'data', jsonb_build_object('type', 'inventory', 'shop_id', NEW.shop_id)
      );

      -- Send the request to Expo using pg_net
      PERFORM net.http_post(
        url := 'https://exp.host/--/api/v2/push/send',
        body := payload,
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger to the shop_inventory table
DROP TRIGGER IF EXISTS trigger_notify_low_stock ON public.shop_inventory;
CREATE TRIGGER trigger_notify_low_stock
AFTER INSERT OR UPDATE OF quantity ON public.shop_inventory
FOR EACH ROW
EXECUTE FUNCTION notify_low_stock();

-- NOTE: Near-expiry alerts require a scheduled job since they depend on time passing, not row updates.
-- If you have pg_cron enabled on your Supabase project, you can run a daily job:
/*
SELECT cron.schedule('check_expiring_inventory', '0 8 * * *', $$
  -- (SQL to find items expiring within 30 days and send notifications via pg_net)
$$);
*/
