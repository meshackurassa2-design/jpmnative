-- Migration: Add push_token column to profiles table for Expo Push Notifications
-- Run this in your Supabase project Dashboard under "SQL Editor"

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Optional: index for lookups
CREATE INDEX IF NOT EXISTS profiles_push_token_idx ON profiles(push_token) WHERE push_token IS NOT NULL;
