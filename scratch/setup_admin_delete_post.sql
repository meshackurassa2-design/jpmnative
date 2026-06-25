CREATE POLICY "Admins can delete any post" ON public.posts FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  )
);
