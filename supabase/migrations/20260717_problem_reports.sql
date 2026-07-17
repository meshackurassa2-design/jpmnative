-- Problem Reports & Disputes Table
-- Allows buyers and sellers to report issues with orders, products, or shops

CREATE TABLE IF NOT EXISTS public.problem_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL, -- 'order', 'product', 'shop'
  target_id TEXT NOT NULL,
  target_name TEXT,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'investigating', 'resolved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.problem_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit problem reports" ON public.problem_reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own problem reports" ON public.problem_reports
  FOR SELECT USING (auth.uid() = reporter_id);
