create table public.live_stations (
    id uuid default gen_random_uuid() primary key,
    host_id uuid references public.profiles(id) on delete cascade not null,
    title text not null,
    cover_url text,
    current_track_id uuid references public.tracks(id) on delete set null,
    started_at timestamp with time zone default now(),
    status text check (status in ('live', 'offline')) default 'live',
    listener_count int default 0,
    created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.live_stations enable row level security;

-- Policies
create policy "Stations are viewable by everyone."
  on public.live_stations for select
  using ( true );

create policy "Users can create their own stations."
  on public.live_stations for insert
  with check ( auth.uid() = host_id );

create policy "Hosts can update their own stations."
  on public.live_stations for update
  using ( auth.uid() = host_id );

create policy "Hosts can delete their own stations."
  on public.live_stations for delete
  using ( auth.uid() = host_id );

-- Enable Realtime for the table
alter publication supabase_realtime add table public.live_stations;
