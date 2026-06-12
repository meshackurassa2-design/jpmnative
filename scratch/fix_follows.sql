-- Fix RLS Policies for the Follows Table
-- This ensures users can actually save their follows permanently in the database

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can see who follows who
DROP POLICY IF EXISTS "Anyone can view follows" ON follows;
CREATE POLICY "Anyone can view follows"
ON follows FOR SELECT
USING (true);

-- 2. Authenticated users can follow others (insert their own follow record)
DROP POLICY IF EXISTS "Users can follow others" ON follows;
CREATE POLICY "Users can follow others"
ON follows FOR INSERT
WITH CHECK (auth.uid() = follower_id);

-- 3. Authenticated users can unfollow (delete their own follow record)
DROP POLICY IF EXISTS "Users can unfollow" ON follows;
CREATE POLICY "Users can unfollow"
ON follows FOR DELETE
USING (auth.uid() = follower_id);
