-- Enable Full Replica Identity and Realtime Publication for all core tables
-- This ensures the mobile & web clients receive instant real-time websocket updates right away when any data changes

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN (
            'posts', 'direct_ads', 'shops', 'order_items', 'wishlists', 
            'profiles', 'problem_reports', 'likes', 'comments', 'reposts', 
            'shop_reviews', 'direct_messages', 'notifications'
          )
    LOOP
        EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', tbl);
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
        EXCEPTION
            WHEN duplicate_object THEN
                -- Table already in publication, ignore
                NULL;
        END;
    END LOOP;
END;
$$;
