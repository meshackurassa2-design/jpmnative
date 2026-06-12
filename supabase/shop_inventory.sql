-- ============================================================
-- Shop Inventory Management System
-- Run this in your Supabase SQL Editor
-- ============================================================

create table if not exists shop_inventory (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade not null,
  name text not null,
  category text,
  quantity integer not null default 0,
  unit text default 'pcs',
  min_stock integer default 5,
  cost_price numeric(10,2),
  selling_price numeric(10,2),
  expiry_date date,
  barcode text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast lookup by shop
create index if not exists idx_shop_inventory_shop_id on shop_inventory(shop_id);

-- Row Level Security: only the shop owner can manage their inventory
alter table shop_inventory enable row level security;

drop policy if exists "shop owner manages inventory" on shop_inventory;
create policy "shop owner manages inventory" on shop_inventory
  using (
    shop_id in (
      select id from shops where owner_id = auth.uid()
    )
  )
  with check (
    shop_id in (
      select id from shops where owner_id = auth.uid()
    )
  );

-- Auto-update `updated_at` on change
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_shop_inventory_updated_at on shop_inventory;
create trigger update_shop_inventory_updated_at
  before update on shop_inventory
  for each row execute function update_updated_at_column();

-- Function: get low stock and near-expiry counts for push notifications
create or replace function get_shop_inventory_alerts(p_shop_id uuid)
returns table(low_stock_count bigint, expiring_soon_count bigint) as $$
begin
  return query
  select
    count(*) filter (where quantity <= min_stock) as low_stock_count,
    count(*) filter (where expiry_date is not null and expiry_date <= (current_date + interval '30 days') and expiry_date >= current_date) as expiring_soon_count
  from shop_inventory
  where shop_id = p_shop_id;
end;
$$ language plpgsql security definer;
