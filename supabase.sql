-- Imran Games — Supabase schema
-- Run in the Supabase SQL Editor. Products verified from imrangames.pk, 18 Nov 2026.
-- Prices in PKR. Sold-out items keep stock = 0.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  category text not null,
  brand text,
  price int not null,
  was_price int,
  stock int not null default 0,
  is_hot boolean not null default false,
  is_new boolean not null default false,
  image_urls text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address text not null,
  city text not null default 'Peshawar',
  payment_method text not null default 'COD',
  total int not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  price int not null,
  qty int not null default 1
);

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Public read for products; orders are written by the checkout (anon) and read by admins only.
do $$ begin
  create policy "products readable by everyone" on public.products for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "orders insertable by everyone" on public.orders for insert with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "order_items insertable by everyone" on public.order_items for insert with check (true);
exception when duplicate_object then null; end $$;

-- Verified sample products (full 40-product catalogue lives in the UI data)
insert into public.products (name, slug, category, brand, price, was_price, stock, is_hot, is_new) values
  ('Sony PlayStation 4 500GB Fat Model', 'ps4-500gb-fat', 'PlayStation', 'Sony', 46500, 55000, 1, false, false),
  ('PlayStation 4 Pro 1TB Used', 'ps4-pro-1tb-used', 'PlayStation', 'Sony', 85000, null, 1, false, false),
  ('Sony PlayStation PS4 DualShock 4 Wireless Controller Black', 'dualshock-4-black', 'PlayStation', 'Sony', 3999, 5500, 1, true, true),
  ('Sony PlayStation PS4 Grand Theft Auto V Premium Edition', 'gta-v-ps4-premium', 'PlayStation', 'Sony', 5250, 7500, 1, true, false),
  ('Sony PlayStation PS4 Red Dead Redemption II', 'rdr2-ps4', 'PlayStation', 'Sony', 5699, 7500, 1, true, false),
  ('Sony PlayStation PS4 Call of Duty Modern Warfare II', 'cod-mwii-ps4', 'PlayStation', 'Sony', 12499, 15500, 1, false, false),
  ('Sony PlayStation PS4 Ghost of Tsushima', 'ghost-of-tsushima-ps4', 'PlayStation', 'Sony', 7449, 12000, 1, false, false),
  ('Microsoft Xbox Series X 1TB SSD Console', 'xbox-series-x-1tb', 'Xbox', 'Microsoft', 220000, 285000, 1, false, false),
  ('Microsoft Xbox Series S 512GB SSD Console', 'xbox-series-s-512gb', 'Xbox', 'Microsoft', 148500, 165000, 1, false, false),
  ('Meta Quest 2 128GB VR Headset', 'meta-quest-2-128gb', 'Other Gaming', 'Meta', 95000, 120000, 1, false, false),
  ('Logitech G29 Driving Force Racing Wheel', 'logitech-g29', 'PlayStation', 'Logitech', 78500, 85000, 1, false, false),
  ('Sony PlayStation 5 Slim 1TB Disc Edition UK', 'ps5-slim-1tb-disc-uk', 'PlayStation', 'Sony', 245000, 260000, 0, false, false),
  ('$10 PS Store Gift Card', 'ps-store-gift-card-10-usd', 'PlayStation', 'Sony', 2850, 3500, 1, false, false),
  ('Onikuma Professional Gaming Headset', 'onikuma-gaming-headset', 'Headphones', 'Onikuma', 4599, 7500, 1, false, false)
on conflict (slug) do nothing;

-- v13 (18 Nov 2026): atomic stock reservation + optimistic locking.
-- Applied live via supabase.py; kept here so the repo documents the schema.
-- Checkout is WhatsApp COD: the shop reserves stock atomically on checkout
-- click (15-min hold) instead of trusting a later WhatsApp message.

alter table public.products add column if not exists version int not null default 1;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  qty int not null,
  session_key text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.reservations enable row level security;
-- No public policies on purpose: only the SECURITY DEFINER functions below touch it.

create or replace function public.reserve_stock(p_product_id uuid, p_qty int, p_session text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if p_qty is null or p_qty < 1 or p_qty > 10 then return false; end if;
  if p_session is null or p_session = '' then return false; end if;
  update public.products set stock = stock - p_qty
    where id = p_product_id and stock >= p_qty;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return false; end if;
  insert into public.reservations (product_id, qty, session_key, expires_at)
    values (p_product_id, p_qty, p_session, now() + interval '15 minutes');
  return true;
end;
$$;

create or replace function public.release_stock(p_product_id uuid, p_qty int, p_session text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with deleted as (
    delete from public.reservations
    where product_id = p_product_id and session_key = p_session
    returning qty
  ),
  totals as (
    select coalesce(sum(qty), 0) as total from deleted
  )
  update public.products
    set stock = stock + (select total from totals)
    where id = p_product_id
      and (select total from totals) > 0;
end;
$$;

create or replace function public.release_expired_reservations()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  with deleted as (
    delete from public.reservations
    where expires_at <= now()
    returning product_id, qty
  ),
  totals as (
    select product_id, sum(qty) as total
    from deleted
    group by product_id
  ),
  restored as (
    update public.products p
      set stock = stock + t.total
      from totals t
      where t.product_id = p.id
      returning p.id
  )
  select count(*) into v_count from deleted;
  return v_count;
end;
$$;

grant execute on function public.reserve_stock(uuid, int, text), public.release_stock(uuid, int, text), public.release_expired_reservations() to anon, authenticated;

-- ============================================================================
-- C-01 fix (2026-11-19): admin flag + admin-only write policies.
-- This section DOCUMENTS the live migration applied 2026-11-19
-- (migrations/2026-11-19-c01-admin-flag.sql). It is kept here so supabase.sql
-- stays the complete, reviewed source of truth for the schema. Before C-01,
-- any authenticated Supabase user was treated as admin by /adminaccess:
-- the products write policies and the audit_log select policy were
-- permissive ("authenticated", true), so any signed-in account could
-- write products and read the audit log. RLS policies are OR'd, so adding
-- an admin-only policy alone does NOT fix C-01 — the permissive policies
-- below MUST be dropped (and are dropped in the live migration).
-- No sample inserts are included here; admin rows are added by the owner
-- in the Supabase dashboard / SQL Editor only.
-- ============================================================================

-- 1. Admin flag table: one row per admin, keyed by the Auth user id.
-- No policies on purpose: no client access at all — only the SECURITY
-- DEFINER function below reads it.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.admins enable row level security;

-- 2. Admin check (SECURITY DEFINER so RLS on admins cannot block it).
-- Callable from the admin page via sb.rpc('is_admin') with the anon key;
-- the JS gate in adminaccess/index.html is defence in depth only — the
-- RLS policies below are the real enforcement.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- 3. products: the public SELECT policy ("products readable by everyone")
-- is unchanged — the shop still reads the catalogue anonymously.
-- All writes (insert / update / delete) now require an admin.
drop policy if exists "products_write_admin" on public.products;
create policy "products_write_admin" on public.products
  for all
  using (auth.role() = 'authenticated' and public.is_admin())
  with check (auth.role() = 'authenticated' and public.is_admin());

-- Drop the old permissive products write policies (the actual C-01 hole).
drop policy if exists "products insert by authenticated" on public.products;
drop policy if exists "products update by authenticated" on public.products;
drop policy if exists "products delete by authenticated" on public.products;

-- 4. audit_log: the live table already exists (id, created_at, actor_email,
-- action, entity, record_id, record_name, details jsonb, ip_address,
-- user_agent). This create is therefore a no-op and must NOT alter it.
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  email text,
  action text,
  ip_address text,
  created_at timestamptz default now()
);

-- Inserts stay authenticated-only (admins log their own actions);
-- selects are now admin-only. The old permissive select policy is dropped.
drop policy if exists "audit_log insert by authenticated" on public.audit_log;
drop policy if exists "audit_log select by authenticated" on public.audit_log;
create policy "audit_log_insert_authenticated" on public.audit_log
  for insert
  with check (auth.role() = 'authenticated');
create policy "audit_log_select_admin" on public.audit_log
  for select
  using (auth.role() = 'authenticated' and public.is_admin());

-- ===== H-03 (2026-11-19): login hardening — lockout =====
-- Sign-up disabled + password minimum 12 are Auth config (Management API), not SQL.
-- Step 4: lockout state column on the admin flag table.
alter table public.admins add column if not exists locked_until timestamptz;

-- Step 5: is_admin() also denies while locked. Same function as C-01 — it gates
-- both the JS admin gate (sb.rpc('is_admin')) and the RLS write policies, so a
-- locked admin loses the dashboard AND writes even though Auth still issues a session.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid()
      and (locked_until is null or locked_until <= now())
  );
$$;

-- Step 6: log_failed_login() extended in place (signature unchanged so the JS call
-- keeps working). Adds SET search_path (was missing), a per-IP throttle (10+/hour
-- from one IP are silently dropped), and the lock trigger: 5 failures for one
-- email in 15 minutes sets locked_until = now() + 15 minutes on that admin's row.
create or replace function public.log_failed_login(p_email text, p_ip text, p_ua text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip_recent_count int;
  v_email_recent_count int;
begin
  select count(*) into v_ip_recent_count
  from public.audit_log
  where action = 'login_failed'
    and ip_address = coalesce(p_ip, 'unknown')
    and created_at > now() - interval '1 hour';

  if v_ip_recent_count >= 10 then
    return;
  end if;

  insert into public.audit_log (actor_email, action, entity, record_name, ip_address, user_agent, details)
  values (p_email, 'login_failed', 'admin', null, coalesce(p_ip,'unknown'), p_ua, jsonb_build_object('email_tried', p_email));

  select count(*) into v_email_recent_count
  from public.audit_log
  where action = 'login_failed'
    and actor_email = p_email
    and created_at > now() - interval '15 minutes';

  if v_email_recent_count >= 5 then
    update public.admins a
      set locked_until = now() + interval '15 minutes'
      from auth.users u
      where u.id = a.user_id and u.email = p_email;
  end if;
end;
$$;

grant execute on function public.log_failed_login(text, text, text) to anon, authenticated;
-- NOTE (H-03 residual risk, accepted with mitigations): log_failed_login is
-- anon-callable, so an attacker who knows the admin email can spam the RPC and
-- trigger a 15-minute lock. Mitigations: CAPTCHA on sign-in (owner setup, still
-- pending), per-IP throttle above, short 15-min lock + dashboard unlock
-- (update public.admins set locked_until = null). GoTrue password-verification
-- hook is the stronger alternative if this risk is later judged unacceptable.

-- ============================================================================
-- Wave 5 (2026-11-19): product add/edit/delete flow — deal price + images.
-- Applied live via supabase.py (migrations/2026-11-19-product-images.sql).
-- Documented here so supabase.sql stays the complete source of truth.
-- Rollback: migrations/2026-11-19-product-images-rollback.sql.
-- ============================================================================

-- 1. Deal price: optional special price, shown on the shop (and admin tiles)
--    instead of price when set and below price. NULL = no deal.
alter table public.products
  add column if not exists deal_price numeric
  constraint products_deal_price_positive check (deal_price is null or deal_price > 0);

-- 2. Realtime on products: the shop and the admin already subscribe; the
--    table must be in the publication for changes to arrive live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'products'
  ) then
    execute 'alter publication supabase_realtime add table public.products';
  end if;
end $$;

-- 3. Storage bucket for product photos (public read; admin-only write).
--    8 MB / jpg+png+webp limits are enforced here AND by the import-image
--    Edge Function + the admin client (the bucket limits are the backstop).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 8388608,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 4. Storage policies: public read; only admins may insert/update/delete.
--    Replaces the old permissive write policies (bucket check only — anyone
--    could upload/delete). The public products SELECT policy is untouched.
drop policy if exists "product images upload by admin" on storage.objects;
drop policy if exists "product images update by admin" on storage.objects;
drop policy if exists "product images delete by admin" on storage.objects;
drop policy if exists "product_images_select_public" on storage.objects;
drop policy if exists "product_images_insert_admin" on storage.objects;
drop policy if exists "product_images_update_admin" on storage.objects;
drop policy if exists "product_images_delete_admin" on storage.objects;

create policy "product_images_select_public" on storage.objects
  for select to public
  using (bucket_id = 'product-images');

create policy "product_images_insert_admin" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and is_admin());

create policy "product_images_update_admin" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and is_admin())
  with check (bucket_id = 'product-images' and is_admin());

create policy "product_images_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and is_admin());
