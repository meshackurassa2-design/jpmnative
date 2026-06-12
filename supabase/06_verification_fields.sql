-- Add new fields to verification_requests table for Instagram-style verification

ALTER TABLE public.verification_requests
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS known_as TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- We don't need strict NOT NULL because old records might exist without them,
-- but the UI will enforce them for new records.
