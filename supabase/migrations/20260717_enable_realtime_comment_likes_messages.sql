-- Enable Full Replica Identity & Realtime for Comment Likes, Likes, Comments, Posts & Messages
-- Ensures instant live updates when users like/unlike posts or comments, or react to direct messages.

DO $$
BEGIN
    -- 1. Set REPLICA IDENTITY FULL so payload.old contains all columns on DELETE events
    BEGIN
        ALTER TABLE public.likes REPLICA IDENTITY FULL;
    EXCEPTION WHEN undefined_table THEN NULL; END;

    BEGIN
        ALTER TABLE public.comment_likes REPLICA IDENTITY FULL;
    EXCEPTION WHEN undefined_table THEN NULL; END;

    BEGIN
        ALTER TABLE public.comments REPLICA IDENTITY FULL;
    EXCEPTION WHEN undefined_table THEN NULL; END;

    BEGIN
        ALTER TABLE public.posts REPLICA IDENTITY FULL;
    EXCEPTION WHEN undefined_table THEN NULL; END;

    BEGIN
        ALTER TABLE public.messages REPLICA IDENTITY FULL;
    EXCEPTION WHEN undefined_table THEN NULL; END;

    -- 2. Add tables to supabase_realtime publication
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.likes;
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL; END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_likes;
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL; END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL; END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL; END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; WHEN undefined_object THEN NULL; END;
END $$;
