-- Add contact_phone to shops and enhance problem_reports with full contact info and shop metadata

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS contact_phone TEXT;

ALTER TABLE public.problem_reports ADD COLUMN IF NOT EXISTS reporter_phone TEXT;
ALTER TABLE public.problem_reports ADD COLUMN IF NOT EXISTS seller_phone TEXT;
ALTER TABLE public.problem_reports ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.problem_reports ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE public.problem_reports ADD COLUMN IF NOT EXISTS target_metadata JSONB;

-- Ensure problem_reports is in realtime publication with new columns
ALTER TABLE public.problem_reports REPLICA IDENTITY FULL;
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.problem_reports;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END;
