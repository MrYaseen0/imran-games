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
