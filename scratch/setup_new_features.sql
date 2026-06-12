-- Setup New Features: Stories & Verification Requests

-- ==========================================
-- 1. STORIES TABLE
-- ==========================================
DROP TABLE IF EXISTS public.stories CASCADE;
CREATE TABLE IF NOT EXISTS public.stories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    image_url TEXT,
    bg_color TEXT,
    text_content TEXT,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now() + interval '24 hours') NOT NULL
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Anyone can view stories
DROP POLICY IF EXISTS "Anyone can view stories" ON public.stories;
CREATE POLICY "Anyone can view stories" ON public.stories
    FOR SELECT USING (true);

-- Users can insert their own stories
DROP POLICY IF EXISTS "Users can insert own stories" ON public.stories;
CREATE POLICY "Users can insert own stories" ON public.stories
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Users can delete their own stories
DROP POLICY IF EXISTS "Users can delete own stories" ON public.stories;
CREATE POLICY "Users can delete own stories" ON public.stories
    FOR DELETE USING (auth.uid() = creator_id);


-- ==========================================
-- 1B. STORY VIEWS & LIKES TABLES
-- ==========================================
DROP TABLE IF EXISTS public.story_views CASCADE;
CREATE TABLE IF NOT EXISTS public.story_views (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
    viewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(story_id, viewer_id)
);
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view story_views" ON public.story_views FOR SELECT USING (true);
CREATE POLICY "Users can insert story_views" ON public.story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

DROP TABLE IF EXISTS public.story_likes CASCADE;
CREATE TABLE IF NOT EXISTS public.story_likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(story_id, user_id)
);
ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view story_likes" ON public.story_likes FOR SELECT USING (true);
CREATE POLICY "Users can insert story_likes" ON public.story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete story_likes" ON public.story_likes FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 2. VERIFICATION REQUESTS TABLE
-- ==========================================
DROP TABLE IF EXISTS public.verification_requests CASCADE;
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE, -- Only 1 active request per user
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests, admins can view all
DROP POLICY IF EXISTS "Users can view own verification requests" ON public.verification_requests;
CREATE POLICY "Users can view own verification requests" ON public.verification_requests
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
    );

-- Users can insert their own request
DROP POLICY IF EXISTS "Users can insert own verification request" ON public.verification_requests;
CREATE POLICY "Users can insert own verification request" ON public.verification_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can update requests
DROP POLICY IF EXISTS "Admins can update verification requests" ON public.verification_requests;
CREATE POLICY "Admins can update verification requests" ON public.verification_requests
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
    );
