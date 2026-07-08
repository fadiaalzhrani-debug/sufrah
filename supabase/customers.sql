-- ============================================================
--  سُفرة — حسابات العملاء (الملف الشخصي + ربط الطلبات)
--  الصقيه في Supabase → SQL Editor → New query → Run
-- ============================================================

-- ملف العميل (الاسم/الجوال/العنوان)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  address    text,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profile_select" on public.profiles;
create policy "profile_select" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profile_insert" on public.profiles;
create policy "profile_insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profile_update" on public.profiles;
create policy "profile_update" on public.profiles for update using (auth.uid() = id);

-- ربط الطلب بحساب العميل
alter table public.orders add column if not exists customer_id uuid;

-- تحديث صلاحية القراءة: العميل يشوف طلباته أيضاً
drop policy if exists "read_orders" on public.orders;
create policy "read_orders" on public.orders for select using (
  (auth.jwt() ->> 'email') = 'fadiaalzhrani@gmail.com'
  or exists (select 1 from public.kitchens k where k.id = kitchen_id and k.owner = auth.uid())
  or customer_id = auth.uid()
);
