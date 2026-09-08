-- Shared foundation for the customer and manager applications.
-- Additive migration: existing local/mock-compatible columns remain intact.

create table if not exists public.cafes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  timezone text not null default 'Africa/Cairo',
  created_at timestamptz not null default now(),
  unique (cafe_id, name)
);

create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  display_name text not null,
  role text not null default 'cashier' check (role in ('owner','manager','cashier','barista')),
  recovery_phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null,
  name_ar text,
  display_order integer not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (branch_id, name)
);

create table if not exists public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  table_id uuid references public.cafe_tables(id) on delete set null,
  customer_name text,
  guest_count integer check (guest_count is null or guest_count > 0),
  status text not null default 'Active' check (status in ('Active','Completed','Expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.cafe_settings add column if not exists branch_id uuid references public.branches(id) on delete cascade;
alter table public.products add column if not exists branch_id uuid references public.branches(id) on delete cascade;
alter table public.products add column if not exists category_id uuid references public.categories(id) on delete set null;
alter table public.cafe_tables add column if not exists branch_id uuid references public.branches(id) on delete cascade;
alter table public.orders add column if not exists branch_id uuid references public.branches(id) on delete cascade;
alter table public.orders add column if not exists customer_session_id uuid references public.customer_sessions(id) on delete set null;

create index if not exists branches_cafe_idx on public.branches(cafe_id);
create index if not exists staff_profiles_branch_idx on public.staff_profiles(branch_id);
create index if not exists categories_branch_order_idx on public.categories(branch_id, display_order);
create index if not exists products_branch_category_idx on public.products(branch_id, category_id, visible);
create index if not exists tables_branch_status_idx on public.cafe_tables(branch_id, status, session_status);
create index if not exists orders_branch_created_idx on public.orders(branch_id, created_at desc);
create index if not exists customer_sessions_branch_status_idx on public.customer_sessions(branch_id, status, created_at desc);

alter table public.cafes enable row level security;
alter table public.branches enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.customer_sessions enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['cafes','branches','staff_profiles','categories','customer_sessions'] loop
    execute format('drop policy if exists %I_authenticated_access on public.%I', table_name, table_name);
    execute format('create policy %I_authenticated_access on public.%I for all to authenticated using (true) with check (true)', table_name, table_name);
  end loop;
end $$;

comment on table public.customer_sessions is 'Customer app session used to associate dine-in orders with a table and guest context.';
