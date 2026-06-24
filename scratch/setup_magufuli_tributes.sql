-- Setup real-time Tribute Wall for Magufuli Legacy Page

-- 1. Create table for Respects (Candles)
CREATE TABLE IF NOT EXISTS public.magufuli_respects (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create table for Tribute Messages
CREATE TABLE IF NOT EXISTS public.magufuli_tributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.magufuli_respects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magufuli_tributes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for magufuli_respects
-- Anyone can read
CREATE POLICY "Respects are viewable by everyone" ON public.magufuli_respects
    FOR SELECT USING (true);
-- Authenticated users can insert their own respect
CREATE POLICY "Users can pay respect" ON public.magufuli_respects
    FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Authenticated users can remove their own respect
CREATE POLICY "Users can remove respect" ON public.magufuli_respects
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for magufuli_tributes
-- Anyone can read
CREATE POLICY "Tributes are viewable by everyone" ON public.magufuli_tributes
    FOR SELECT USING (true);
-- Authenticated users can insert
CREATE POLICY "Users can post tributes" ON public.magufuli_tributes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Users can delete their own
CREATE POLICY "Users can delete own tributes" ON public.magufuli_tributes
    FOR DELETE USING (auth.uid() = user_id);

-- Turn on Realtime for both tables!
alter publication supabase_realtime add table magufuli_respects;
alter publication supabase_realtime add table magufuli_tributes;
