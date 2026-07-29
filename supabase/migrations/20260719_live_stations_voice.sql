-- Add voice broadcasting columns to live_stations
alter table public.live_stations add column if not exists current_voice_url text;
alter table public.live_stations add column if not exists voice_started_at timestamp with time zone;
