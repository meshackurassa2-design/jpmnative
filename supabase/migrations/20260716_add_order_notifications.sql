-- Enable pg_net if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Function to notify buyer when an order is DELIVERED
CREATE OR REPLACE FUNCTION notify_buyer_order_delivered()
RETURNS TRIGGER AS $$
DECLARE
  buyer_token text;
  b_id uuid;
  payload jsonb;
BEGIN
  -- Only trigger if status changed to DELIVERED
  IF NEW.status = 'DELIVERED' AND (OLD.status IS DISTINCT FROM 'DELIVERED') THEN
    
    -- Find the buyer_id from the related orders table
    SELECT buyer_id INTO b_id FROM public.orders WHERE id = NEW.order_id;
    
    -- Get the buyer's push token
    IF b_id IS NOT NULL THEN
      SELECT push_token INTO buyer_token FROM public.profiles WHERE id = b_id;
      
      IF buyer_token IS NOT NULL THEN
        payload := jsonb_build_object(
          'to', buyer_token,
          'title', 'Package Delivered! 📦',
          'body', 'Your order for ' || NEW.product_name || ' has arrived safely.',
          'sound', 'default',
          'data', jsonb_build_object('type', 'order', 'order_id', NEW.order_id, 'item_id', NEW.id)
        );

        PERFORM net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          body := payload,
          headers := '{"Content-Type": "application/json"}'::jsonb
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for delivery notifications
DROP TRIGGER IF EXISTS trigger_order_delivered ON public.order_items;
CREATE TRIGGER trigger_order_delivered
AFTER UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION notify_buyer_order_delivered();


-- 2. Function to notify seller when a new order is placed
CREATE OR REPLACE FUNCTION notify_seller_new_order()
RETURNS TRIGGER AS $$
DECLARE
  seller_token text;
  payload jsonb;
BEGIN
  -- Get the seller's push token (shop_id acts as owner_id here)
  IF NEW.shop_id IS NOT NULL THEN
    SELECT push_token INTO seller_token FROM public.profiles WHERE id = NEW.shop_id;
    
    IF seller_token IS NOT NULL THEN
      payload := jsonb_build_object(
        'to', seller_token,
        'title', 'New Order Received! 🛒',
        'body', 'You have a new order for ' || NEW.product_name || '. Please prepare it and update the buyer on shipping!',
        'sound', 'default',
        'data', jsonb_build_object('type', 'new_order', 'item_id', NEW.id)
      );

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

-- Trigger for new order notifications
DROP TRIGGER IF EXISTS trigger_new_order_placed ON public.order_items;
CREATE TRIGGER trigger_new_order_placed
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION notify_seller_new_order();
