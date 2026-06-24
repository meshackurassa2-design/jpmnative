-- Create best_friends table
create table if not exists public.best_friends (
  user_id uuid references auth.users not null,
  friend_id uuid references auth.users not null,
  created_at timestamp with time zone default now(),
  primary key(user_id, friend_id)
);

-- Enable RLS
alter table public.best_friends enable row level security;

-- Policies
create policy "Users can view their own best friends"
  on public.best_friends for select
  using (auth.uid() = user_id);

create policy "Users can see who has them as a best friend (for story logic)"
  on public.best_friends for select
  using (auth.uid() = friend_id);

create policy "Users can add best friends"
  on public.best_friends for insert
  with check (auth.uid() = user_id);

create policy "Users can remove best friends"
  on public.best_friends for delete
  using (auth.uid() = user_id);

-- Create a function to check the 5 friend limit
create or replace function check_best_friends_limit()
returns trigger as $$
declare
  friend_count int;
begin
  select count(*) into friend_count from public.best_friends where user_id = NEW.user_id;
  if friend_count >= 5 then
    raise exception 'You can only have a maximum of 5 best friends.';
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Create trigger
drop trigger if exists enforce_best_friends_limit on public.best_friends;
create trigger enforce_best_friends_limit
  before insert on public.best_friends
  for each row
  execute function check_best_friends_limit();
