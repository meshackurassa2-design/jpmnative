-- Add initial_message column to message_requests to store the introductory message sent with a request
ALTER TABLE public.message_requests ADD COLUMN IF NOT EXISTS initial_message TEXT;
