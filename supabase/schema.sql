-- ============================================================
--  سُفرة — قاعدة البيانات (المرحلة ١: الأسر المنتجة والأطباق)
--  الصقي هذا الكود كاملاً في:  Supabase → SQL Editor → New query
--  ثم اضغط  Run.  (آمن لإعادة التشغيل أكثر من مرة)
-- ============================================================

-- 1) جدول المطابخ (الأسر المنتجة)
create table if not exists public.kitchens (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  cuisine    text not null default 'saudi',
  city       text,
  emoji      text default '🍽️',
  rating     numeric default 5.0,
  verified   boolean default false,
  created_at timestamptz default now()
);

-- 2) جدول الأطباق
create table if not exists public.dishes (
  id          uuid primary key default gen_random_uuid(),
  kitchen_id  uuid not null references public.kitchens(id) on delete cascade,
  name        text not null,
  category    text not null default 'main',
  cuisine     text not null default 'saudi',
  price       numeric not null check (price >= 0),
  description text,
  image_url   text,
  delivery    text[] default array['pickup','family','courier'],
  tag         text,
  available   boolean default true,
  created_at  timestamptz default now()
);

-- تفعيل الحماية على مستوى الصف (Row Level Security)
alter table public.kitchens enable row level security;
alter table public.dishes   enable row level security;

-- الجميع يقدر يتصفّح المطابخ والأطباق (قراءة عامة)
drop policy if exists "read_kitchens" on public.kitchens;
create policy "read_kitchens" on public.kitchens for select using (true);

drop policy if exists "read_dishes" on public.dishes;
create policy "read_dishes" on public.dishes for select using (true);

-- كل أسرة تدير مطبخها هي فقط
drop policy if exists "own_kitchen_insert" on public.kitchens;
create policy "own_kitchen_insert" on public.kitchens for insert with check (auth.uid() = owner);
drop policy if exists "own_kitchen_update" on public.kitchens;
create policy "own_kitchen_update" on public.kitchens for update using (auth.uid() = owner);
drop policy if exists "own_kitchen_delete" on public.kitchens;
create policy "own_kitchen_delete" on public.kitchens for delete using (auth.uid() = owner);

-- كل أسرة تدير أطباق مطبخها فقط
drop policy if exists "own_dishes_insert" on public.dishes;
create policy "own_dishes_insert" on public.dishes for insert
  with check (exists (select 1 from public.kitchens k where k.id = kitchen_id and k.owner = auth.uid()));
drop policy if exists "own_dishes_update" on public.dishes;
create policy "own_dishes_update" on public.dishes for update
  using (exists (select 1 from public.kitchens k where k.id = kitchen_id and k.owner = auth.uid()));
drop policy if exists "own_dishes_delete" on public.dishes;
create policy "own_dishes_delete" on public.dishes for delete
  using (exists (select 1 from public.kitchens k where k.id = kitchen_id and k.owner = auth.uid()));

-- 3) مخزن صور الأطباق (Storage)
insert into storage.buckets (id, name, public)
  values ('dish-images', 'dish-images', true)
  on conflict (id) do nothing;

drop policy if exists "images_public_read" on storage.objects;
create policy "images_public_read" on storage.objects for select using (bucket_id = 'dish-images');
drop policy if exists "images_auth_upload" on storage.objects;
create policy "images_auth_upload" on storage.objects for insert to authenticated with check (bucket_id = 'dish-images');

-- ============================================================
--  تمّ! الجداول جاهزة. المرحلة القادمة نضيف: الطلبات + السواقين.
-- ============================================================
