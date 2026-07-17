-- Track AI invoice scan usage per user per month
create table if not exists public.ai_scan_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null, -- format: 'YYYY-MM'
  scan_count integer not null default 0,
  paid_at timestamptz null, -- set when user pays 500 TSH for the month
  created_at timestamptz default now(),
  unique(user_id, month)
);

-- RLS
alter table public.ai_scan_usage enable row level security;

create policy "Users can read own usage"
  on public.ai_scan_usage for select
  using (auth.uid() = user_id);

create policy "Users can upsert own usage"
  on public.ai_scan_usage for insert
  with check (auth.uid() = user_id);

create policy "Users can update own usage"
  on public.ai_scan_usage for update
  using (auth.uid() = user_id);

-- Function to increment scan count and return current state
create or replace function public.increment_ai_scan_usage(p_user_id uuid, p_month text)
returns table(scan_count int, paid_at timestamptz) 
language plpgsql security definer as $$
begin
  insert into public.ai_scan_usage(user_id, month, scan_count)
  values (p_user_id, p_month, 1)
  on conflict (user_id, month)
  do update set scan_count = ai_scan_usage.scan_count + 1;

  return query
    select u.scan_count, u.paid_at
    from public.ai_scan_usage u
    where u.user_id = p_user_id and u.month = p_month;
end;
$$;

-- Function to mark payment done for this month (called after successful payment)
create or replace function public.mark_ai_scan_paid(p_user_id uuid, p_month text)
returns void language plpgsql security definer as $$
begin
  insert into public.ai_scan_usage(user_id, month, scan_count, paid_at)
  values (p_user_id, p_month, 0, now())
  on conflict (user_id, month)
  do update set paid_at = now();
end;
$$;
