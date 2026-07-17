-- Add parent_id column to comments table to support threaded/nested replies
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;
