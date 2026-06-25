ALTER TABLE public.posts ADD CONSTRAINT posts_not_empty CHECK (
  length(trim(content)) > 0 OR
  (image_urls IS NOT NULL AND array_length(image_urls, 1) > 0) OR
  video_url IS NOT NULL
);
