-- App Store Readiness: Blocking and Reporting Tables

-- 1. User Blocks Table
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(blocker_id, blocked_id)
);

-- Enable RLS
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

-- Policies for blocks
CREATE POLICY "Users can block others" ON public.user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can see who they blocked" ON public.user_blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock others" ON public.user_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- 2. Content Reports Table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text DEFAULT 'pending' NOT NULL, -- pending, reviewed, dismissed
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CHECK (post_id IS NOT NULL OR comment_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Policies for reports
CREATE POLICY "Users can submit reports" ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view reports" ON public.content_reports FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);
CREATE POLICY "Admins can update reports" ON public.content_reports FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);
